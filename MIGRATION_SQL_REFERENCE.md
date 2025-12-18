# SQL Reference Guide

Quick reference for database schema and SQL functions used in the migration.

## Database Schema

### Tables Overview

```
sections
  ├── items
  │   ├── approvals (one per role: client/cray)
  │   │   └── replacement_urls (array as table)
  │   ├── orders
  │   ├── comments (one per role: client/cray)
  │   └── custom_fields
  └── edit_history (references items)
```

### Key Relationships

- `items.section_id` → `sections.id` (many-to-one)
- `approvals.item_id` → `items.id` (one-to-many, unique per role)
- `replacement_urls.approval_id` → `approvals.id` (one-to-many)
- `orders.item_id` → `items.id` (one-to-one)
- `comments.item_id` → `items.id` (one-to-many, unique per role)

## Common Queries

### Get All Materials (for API response)

```sql
SELECT 
    s.id as section_id,
    s.label as section_label,
    i.id as item_id,
    i.product,
    i.reference,
    i.supplier_link,
    i.labor_type,
    i.price_ttc,
    i.price_ht_quote,
    -- Client approval
    ac.status as client_status,
    ac.note as client_note,
    ac.validated_at as client_validated_at,
    -- Cray approval
    ay.status as cray_status,
    ay.note as cray_note,
    -- Order info
    o.ordered,
    o.order_date,
    o.delivery_date,
    o.delivery_status,
    o.quantity,
    -- Comments
    cc.comment_text as cray_comment,
    cl.comment_text as client_comment
FROM sections s
JOIN items i ON i.section_id = s.id
LEFT JOIN approvals ac ON ac.item_id = i.id AND ac.role = 'client'
LEFT JOIN approvals ay ON ay.item_id = i.id AND ay.role = 'cray'
LEFT JOIN orders o ON o.item_id = i.id
LEFT JOIN comments cc ON cc.item_id = i.id AND cc.role = 'cray'
LEFT JOIN comments cl ON cl.item_id = i.id AND cl.role = 'client'
ORDER BY s.label, i.product;
```

### Get Replacement URLs for Item

```sql
SELECT ru.url
FROM replacement_urls ru
JOIN approvals a ON a.id = ru.approval_id
WHERE a.item_id = :item_id AND a.role = :role;
```

## SQL Functions for Agent Tools

### 1. Get Items Needing Validation

```sql
CREATE OR REPLACE FUNCTION get_items_needing_validation(p_role VARCHAR)
RETURNS TABLE (
    item_id INTEGER,
    section_id VARCHAR,
    section_label VARCHAR,
    product TEXT,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        s.id,
        s.label,
        i.product,
        COALESCE(a.status, 'pending') as status
    FROM items i
    JOIN sections s ON i.section_id = s.id
    LEFT JOIN approvals a ON a.item_id = i.id AND a.role = p_role
    WHERE a.status IS NULL 
       OR a.status NOT IN ('approved', 'supplied_by')
    ORDER BY s.label, i.product;
END;
$$ LANGUAGE plpgsql;
```

### 2. Get TODO Items

```sql
CREATE OR REPLACE FUNCTION get_todo_items(p_role VARCHAR)
RETURNS TABLE (
    item_id INTEGER,
    section_label VARCHAR,
    product TEXT,
    action_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        i.id,
        s.label,
        i.product,
        CASE 
            WHEN a.status IS NULL OR a.status != 'approved' THEN 'validation'
            WHEN o.ordered = FALSE THEN 'needs ordering'
            WHEN o.delivery_date IS NOT NULL THEN 'delivery tracking'
        END as action_reason
    FROM items i
    JOIN sections s ON i.section_id = s.id
    LEFT JOIN approvals a ON a.item_id = i.id AND a.role = p_role
    LEFT JOIN orders o ON o.item_id = i.id
    WHERE (a.status IS NULL OR a.status != 'approved')
       OR o.ordered = FALSE
       OR o.delivery_date IS NOT NULL
    ORDER BY s.label, i.product;
END;
$$ LANGUAGE plpgsql;
```

### 3. Update Item Approval Status

```sql
CREATE OR REPLACE FUNCTION update_item_approval(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_status VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO approvals (item_id, role, status, updated_at)
    VALUES (p_item_id, p_role, p_status, NOW())
    ON CONFLICT (item_id, role) 
    DO UPDATE SET 
        status = p_status, 
        updated_at = NOW();
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

### 4. Add Replacement URL

```sql
CREATE OR REPLACE FUNCTION add_replacement_url(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_url TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_approval_id INTEGER;
BEGIN
    -- Get or create approval record
    INSERT INTO approvals (item_id, role, status)
    VALUES (p_item_id, p_role, NULL)
    ON CONFLICT (item_id, role) DO NOTHING
    RETURNING id INTO v_approval_id;
    
    IF v_approval_id IS NULL THEN
        SELECT id INTO v_approval_id
        FROM approvals
        WHERE item_id = p_item_id AND role = p_role;
    END IF;
    
    -- Add URL if not exists
    INSERT INTO replacement_urls (approval_id, url)
    SELECT v_approval_id, p_url
    WHERE NOT EXISTS (
        SELECT 1 FROM replacement_urls 
        WHERE approval_id = v_approval_id AND url = p_url
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

### 5. Remove Replacement URL

```sql
CREATE OR REPLACE FUNCTION remove_replacement_url(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_url TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_approval_id INTEGER;
BEGIN
    SELECT id INTO v_approval_id
    FROM approvals
    WHERE item_id = p_item_id AND role = p_role;
    
    IF v_approval_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    DELETE FROM replacement_urls
    WHERE approval_id = v_approval_id AND url = p_url;
    
    RETURN ROW_COUNT > 0;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

### 6. Get Pricing Summary

```sql
CREATE OR REPLACE FUNCTION get_pricing_summary()
RETURNS TABLE (
    total_ttc DECIMAL,
    total_ht DECIMAL,
    item_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(price_ttc), 0)::DECIMAL as total_ttc,
        COALESCE(SUM(price_ht_quote), 0)::DECIMAL as total_ht,
        COUNT(*)::INTEGER as item_count
    FROM items
    WHERE price_ttc IS NOT NULL OR price_ht_quote IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
```

### 7. Get Items by Section

```sql
CREATE OR REPLACE FUNCTION get_items_by_section(p_section_id VARCHAR)
RETURNS TABLE (
    item_id INTEGER,
    product TEXT,
    reference VARCHAR,
    price_ttc DECIMAL,
    price_ht DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.product,
        i.reference,
        i.price_ttc,
        i.price_ht_quote
    FROM items i
    WHERE i.section_id = p_section_id
    ORDER BY i.product;
END;
$$ LANGUAGE plpgsql;
```

### 8. Get Item Status

```sql
CREATE OR REPLACE FUNCTION get_item_status(p_item_id INTEGER)
RETURNS TABLE (
    product TEXT,
    client_status VARCHAR,
    cray_status VARCHAR,
    ordered BOOLEAN,
    delivery_date VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.product,
        ac.status as client_status,
        ay.status as cray_status,
        COALESCE(o.ordered, FALSE) as ordered,
        o.delivery_date
    FROM items i
    LEFT JOIN approvals ac ON ac.item_id = i.id AND ac.role = 'client'
    LEFT JOIN approvals ay ON ay.item_id = i.id AND ay.role = 'cray'
    LEFT JOIN orders o ON o.item_id = i.id
    WHERE i.id = p_item_id;
END;
$$ LANGUAGE plpgsql;
```

## Role-Based Query Examples

### Client Role Queries

```sql
-- Items needing client validation
SELECT * FROM get_items_needing_validation('client');

-- Client's TODO items
SELECT * FROM get_todo_items('client');
```

### Contractor (Cray) Role Queries

```sql
-- Items needing cray validation
SELECT * FROM get_items_needing_validation('cray');

-- Contractor's TODO items
SELECT * FROM get_todo_items('cray');
```

## Performance Tips

1. **Use Indexes**: All foreign keys and commonly queried fields are indexed
2. **Use Functions**: SQL functions are pre-compiled and faster than ad-hoc queries
3. **Limit Results**: Always use LIMIT for large result sets
4. **Use Transactions**: Wrap multiple operations in transactions for consistency

## Migration Helpers

### Count Items in Each Table

```sql
SELECT 'sections' as table_name, COUNT(*) as count FROM sections
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'approvals', COUNT(*) FROM approvals
UNION ALL
SELECT 'replacement_urls', COUNT(*) FROM replacement_urls
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'comments', COUNT(*) FROM comments;
```

### Verify Data Integrity

```sql
-- Check for orphaned records
SELECT COUNT(*) as orphaned_items
FROM items i
LEFT JOIN sections s ON i.section_id = s.id
WHERE s.id IS NULL;

-- Check for items without approvals
SELECT COUNT(*) as items_without_approvals
FROM items i
WHERE NOT EXISTS (
    SELECT 1 FROM approvals a WHERE a.item_id = i.id
);
```

















