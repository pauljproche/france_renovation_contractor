-- ============================================================================
-- SQL Functions for Agent Tools (Phase 5)
-- ============================================================================
-- 
-- These functions provide secure, indirect access to database for the AI agent.
-- The agent_user role can ONLY execute these functions, not directly modify tables.
-- All modifications go through functions with permission checks.
-- 
-- Security Model:
-- - agent_user role: SELECT + EXECUTE only (no direct INSERT/UPDATE/DELETE)
-- - All functions use SECURITY DEFINER for controlled writes
-- - Permission checks inside functions restrict agent actions
-- - Parameterized queries prevent SQL injection
-- ============================================================================

-- ============================================================================
-- READ-ONLY QUERY FUNCTIONS (Indirect Access)
-- ============================================================================

-- Function: Get items needing validation for a role
CREATE OR REPLACE FUNCTION get_items_needing_validation(
    p_role VARCHAR,
    p_project_id VARCHAR DEFAULT NULL
) RETURNS TABLE (
    item_id INTEGER,
    section_id VARCHAR,
    section_label VARCHAR,
    product TEXT,
    status VARCHAR,
    current_value JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        s.id as section_id,
        s.label as section_label,
        i.product,
        a.status::VARCHAR as status,
        to_jsonb(a.status) as current_value
    FROM items i
    JOIN sections s ON i.section_id = s.id
    LEFT JOIN approvals a ON a.item_id = i.id AND a.role = p_role
    WHERE (p_project_id IS NULL OR s.project_id = p_project_id)
      AND (a.status IS NULL 
           OR a.status::text NOT IN ('APPROVED', 'SUPPLIED_BY'))
    ORDER BY s.label, i.product;
END;
$$ LANGUAGE plpgsql;

-- Function: Get TODO items for a role
CREATE OR REPLACE FUNCTION get_todo_items(
    p_role VARCHAR,
    p_project_id VARCHAR DEFAULT NULL
) RETURNS TABLE (
    item_id INTEGER,
    section_id VARCHAR,
    section_label VARCHAR,
    product TEXT,
    action_reason TEXT,
    labor_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        s.id as section_id,
        s.label as section_label,
        i.product,
        CASE 
            WHEN a.status IS NULL OR a.status != 'approved' THEN 'validation'
            WHEN o.ordered = FALSE THEN 'needs ordering'
            WHEN o.delivery_date IS NOT NULL THEN 'delivery tracking'
            ELSE 'other'
        END as action_reason,
        i.labor_type::VARCHAR as labor_type
    FROM items i
    JOIN sections s ON i.section_id = s.id
    LEFT JOIN approvals a ON a.item_id = i.id AND a.role = p_role
    LEFT JOIN orders o ON o.item_id = i.id
    WHERE (p_project_id IS NULL OR s.project_id = p_project_id)
      AND (
          (a.status IS NULL OR a.status != 'approved')
          OR o.ordered = FALSE
          OR o.delivery_date IS NOT NULL
      )
    ORDER BY s.label, i.product;
END;
$$ LANGUAGE plpgsql;

-- Function: Get pricing summary
CREATE OR REPLACE FUNCTION get_pricing_summary(
    p_project_id VARCHAR DEFAULT NULL
) RETURNS TABLE (
    total_ttc DECIMAL,
    total_ht DECIMAL,
    item_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(i.price_ttc), 0) as total_ttc,
        COALESCE(SUM(i.price_ht_quote), 0) as total_ht,
        COUNT(*)::INTEGER as item_count
    FROM items i
    JOIN sections s ON i.section_id = s.id
    WHERE (p_project_id IS NULL OR s.project_id = p_project_id)
      AND (i.price_ttc IS NOT NULL OR i.price_ht_quote IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Function: Get items by section
CREATE OR REPLACE FUNCTION get_items_by_section(
    p_section_id VARCHAR,
    p_project_id VARCHAR DEFAULT NULL
) RETURNS TABLE (
    item_id INTEGER,
    product TEXT,
    reference VARCHAR,
    price_ttc DECIMAL,
    price_ht_quote DECIMAL,
    labor_type VARCHAR,
    client_status VARCHAR,
    contractor_status VARCHAR,
    ordered BOOLEAN,
    delivery_date VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.product,
        i.reference,
        i.price_ttc,
        i.price_ht_quote,
        i.labor_type::VARCHAR as labor_type,
        a_client.status::VARCHAR as client_status,
        a_contractor.status::VARCHAR as contractor_status,
        COALESCE(o.ordered, FALSE) as ordered,
        o.delivery_date
    FROM items i
    JOIN sections s ON i.section_id = s.id
    LEFT JOIN approvals a_client ON a_client.item_id = i.id AND a_client.role = 'client'
    LEFT JOIN approvals a_contractor ON a_contractor.item_id = i.id AND a_contractor.role = 'contractor'
    LEFT JOIN orders o ON o.item_id = i.id
    WHERE i.section_id = p_section_id
      AND (p_project_id IS NULL OR s.project_id = p_project_id)
    ORDER BY i.id;
END;
$$ LANGUAGE plpgsql;

-- Function: Search items by product name
CREATE OR REPLACE FUNCTION search_items(
    p_product_search VARCHAR,
    p_project_id VARCHAR DEFAULT NULL
) RETURNS TABLE (
    item_id INTEGER,
    section_id VARCHAR,
    section_label VARCHAR,
    product TEXT,
    reference VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        s.id as section_id,
        s.label as section_label,
        i.product,
        i.reference
    FROM items i
    JOIN sections s ON i.section_id = s.id
    WHERE (p_project_id IS NULL OR s.project_id = p_project_id)
      AND LOWER(i.product) LIKE '%' || LOWER(p_product_search) || '%'
    ORDER BY s.label, i.product;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE FUNCTIONS (WITH PERMISSION CHECKS)
-- ============================================================================

-- Function: Update item approval status (WITH PERMISSION CHECK)
CREATE OR REPLACE FUNCTION update_item_approval_preview(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_status VARCHAR,
    p_user_role VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_item_record RECORD;
    v_old_status VARCHAR;
    v_sql_query TEXT;
    v_sql_params JSONB;
    v_nlp_interpretation TEXT;
BEGIN
    -- Validate item exists
    SELECT i.*, s.label as section_label, s.id as section_id
    INTO v_item_record
    FROM items i
    JOIN sections s ON i.section_id = s.id
    WHERE i.id = p_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % does not exist', p_item_id;
    END IF;
    
    -- Validate status value
    IF p_status IS NOT NULL AND p_status NOT IN ('approved', 'rejected', 'change_order', 'pending', 'supplied_by') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;
    
    -- Get current status
    SELECT status INTO v_old_status
    FROM approvals
    WHERE item_id = p_item_id AND role = p_role;
    
    -- Generate SQL query (don't execute)
    v_sql_query := 'INSERT INTO approvals (item_id, role, status, updated_at) VALUES (:item_id, :role, :status, NOW()) ON CONFLICT (item_id, role) DO UPDATE SET status = :status, updated_at = NOW()';
    v_sql_params := jsonb_build_object(
        'item_id', p_item_id,
        'role', p_role,
        'status', p_status
    );
    
    -- Generate NLP interpretation
    IF p_status = 'approved' THEN
        v_nlp_interpretation := format('Approve ''%s'' in %s as %s', v_item_record.product, v_item_record.section_label, p_role);
    ELSIF p_status = 'rejected' THEN
        v_nlp_interpretation := format('Reject ''%s'' in %s as %s', v_item_record.product, v_item_record.section_label, p_role);
    ELSE
        v_nlp_interpretation := format('Set %s approval status for ''%s'' to ''%s''', p_role, v_item_record.product, p_status);
    END IF;
    
    -- Return preview (don't execute)
    RETURN jsonb_build_object(
        'action', 'update_item_approval',
        'item_id', p_item_id,
        'item_product', v_item_record.product,
        'section_id', v_item_record.section_id,
        'section_label', v_item_record.section_label,
        'field_path', format('approvals.%s.status', p_role),
        'current_value', v_old_status,
        'new_value', p_status,
        'sql', jsonb_build_object(
            'query', v_sql_query,
            'params', v_sql_params
        ),
        'nlp', v_nlp_interpretation,
        'affected_items', jsonb_build_array(
            jsonb_build_object(
                'id', p_item_id,
                'product', v_item_record.product,
                'section', v_item_record.section_label
            )
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Execute update_item_approval (called after confirmation)
CREATE OR REPLACE FUNCTION execute_update_item_approval(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_status VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_status VARCHAR;
BEGIN
    -- Get old status for edit history
    SELECT status INTO v_old_status
    FROM approvals
    WHERE item_id = p_item_id AND role = p_role;
    
    -- Perform update (atomic)
    INSERT INTO approvals (item_id, role, status, updated_at)
    VALUES (p_item_id, p_role, p_status, NOW())
    ON CONFLICT (item_id, role) 
    DO UPDATE SET status = p_status, updated_at = NOW();
    
    -- Log edit history
    INSERT INTO edit_history (item_id, field_path, old_value, new_value, source)
    VALUES (
        p_item_id, 
        format('approvals.%s.status', p_role),
        to_jsonb(v_old_status),
        to_jsonb(p_status),
        'agent'
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update approval';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Add replacement URL preview
CREATE OR REPLACE FUNCTION add_replacement_url_preview(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_url TEXT
) RETURNS JSONB AS $$
DECLARE
    v_item_record RECORD;
    v_approval_id INTEGER;
    v_current_urls TEXT[];
    v_sql_query TEXT;
    v_sql_params JSONB;
    v_nlp_interpretation TEXT;
BEGIN
    -- Validate item exists
    SELECT i.*, s.label as section_label, s.id as section_id
    INTO v_item_record
    FROM items i
    JOIN sections s ON i.section_id = s.id
    WHERE i.id = p_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % does not exist', p_item_id;
    END IF;
    
    -- Validate URL
    IF p_url IS NULL OR LENGTH(TRIM(p_url)) = 0 THEN
        RAISE EXCEPTION 'URL cannot be empty';
    END IF;
    
    -- Get or find approval record
    SELECT id INTO v_approval_id
    FROM approvals
    WHERE item_id = p_item_id AND role = p_role;
    
    -- Get current URLs
    SELECT ARRAY_AGG(url) INTO v_current_urls
    FROM replacement_urls
    WHERE approval_id = v_approval_id;
    
    IF v_current_urls IS NULL THEN
        v_current_urls := ARRAY[]::TEXT[];
    END IF;
    
    -- Generate SQL query
    v_sql_query := 'INSERT INTO replacement_urls (approval_id, url) SELECT :approval_id, :url WHERE NOT EXISTS (SELECT 1 FROM replacement_urls WHERE approval_id = :approval_id AND url = :url)';
    v_sql_params := jsonb_build_object(
        'approval_id', v_approval_id,
        'url', p_url
    );
    
    -- Generate NLP
    v_nlp_interpretation := format('Add replacement URL ''%s'' to ''%s'' in %s as %s', p_url, v_item_record.product, v_item_record.section_label, p_role);
    
    -- Return preview
    RETURN jsonb_build_object(
        'action', 'add_replacement_url',
        'item_id', p_item_id,
        'item_product', v_item_record.product,
        'section_id', v_item_record.section_id,
        'section_label', v_item_record.section_label,
        'field_path', format('approvals.%s.replacementUrls', p_role),
        'current_value', to_jsonb(v_current_urls),
        'new_value', to_jsonb(v_current_urls || ARRAY[p_url]),
        'sql', jsonb_build_object(
            'query', v_sql_query,
            'params', v_sql_params
        ),
        'nlp', v_nlp_interpretation,
        'affected_items', jsonb_build_array(
            jsonb_build_object(
                'id', p_item_id,
                'product', v_item_record.product,
                'section', v_item_record.section_label
            )
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Execute add_replacement_url (called after confirmation)
CREATE OR REPLACE FUNCTION execute_add_replacement_url(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_url TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_approval_id INTEGER;
BEGIN
    -- Get or create approval record
    SELECT id INTO v_approval_id
    FROM approvals
    WHERE item_id = p_item_id AND role = p_role;
    
    IF v_approval_id IS NULL THEN
        INSERT INTO approvals (item_id, role, status)
        VALUES (p_item_id, p_role, NULL)
        RETURNING id INTO v_approval_id;
    END IF;
    
    -- Add URL if not exists (atomic)
    INSERT INTO replacement_urls (approval_id, url)
    SELECT v_approval_id, p_url
    WHERE NOT EXISTS (
        SELECT 1 FROM replacement_urls 
        WHERE approval_id = v_approval_id AND url = p_url
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to add replacement URL';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Remove replacement URL preview
CREATE OR REPLACE FUNCTION remove_replacement_url_preview(
    p_item_id INTEGER,
    p_role VARCHAR,
    p_url TEXT
) RETURNS JSONB AS $$
DECLARE
    v_item_record RECORD;
    v_approval_id INTEGER;
    v_current_urls TEXT[];
    v_sql_query TEXT;
    v_sql_params JSONB;
    v_nlp_interpretation TEXT;
BEGIN
    -- Validate item exists
    SELECT i.*, s.label as section_label, s.id as section_id
    INTO v_item_record
    FROM items i
    JOIN sections s ON i.section_id = s.id
    WHERE i.id = p_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % does not exist', p_item_id;
    END IF;
    
    -- Get approval record
    SELECT id INTO v_approval_id
    FROM approvals
    WHERE item_id = p_item_id AND role = p_role;
    
    IF v_approval_id IS NULL THEN
        RAISE EXCEPTION 'No approval record found for item % and role %', p_item_id, p_role;
    END IF;
    
    -- Get current URLs
    SELECT ARRAY_AGG(url) INTO v_current_urls
    FROM replacement_urls
    WHERE approval_id = v_approval_id;
    
    IF v_current_urls IS NULL OR NOT (p_url = ANY(v_current_urls)) THEN
        RAISE EXCEPTION 'URL % not found in replacement URLs', p_url;
    END IF;
    
    -- Generate SQL query
    v_sql_query := 'DELETE FROM replacement_urls WHERE approval_id = :approval_id AND url = :url';
    v_sql_params := jsonb_build_object(
        'approval_id', v_approval_id,
        'url', p_url
    );
    
    -- Generate NLP
    v_nlp_interpretation := format('Remove replacement URL ''%s'' from ''%s'' in %s as %s', p_url, v_item_record.product, v_item_record.section_label, p_role);
    
    -- Return preview
    RETURN jsonb_build_object(
        'action', 'remove_replacement_url',
        'item_id', p_item_id,
        'item_product', v_item_record.product,
        'section_id', v_item_record.section_id,
        'section_label', v_item_record.section_label,
        'field_path', format('approvals.%s.replacementUrls', p_role),
        'current_value', to_jsonb(v_current_urls),
        'new_value', to_jsonb(ARRAY(SELECT unnest(v_current_urls) EXCEPT SELECT p_url))),
        'sql', jsonb_build_object(
            'query', v_sql_query,
            'params', v_sql_params
        ),
        'nlp', v_nlp_interpretation,
        'affected_items', jsonb_build_array(
            jsonb_build_object(
                'id', p_item_id,
                'product', v_item_record.product,
                'section', v_item_record.section_label
            )
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Execute remove_replacement_url (called after confirmation)
CREATE OR REPLACE FUNCTION execute_remove_replacement_url(
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
    
    -- Remove URL (atomic)
    DELETE FROM replacement_urls
    WHERE approval_id = v_approval_id AND url = p_url;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to remove replacement URL';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update item field preview (generic)
CREATE OR REPLACE FUNCTION update_item_field_preview(
    p_item_id INTEGER,
    p_field_name VARCHAR,
    p_new_value JSONB,
    p_expected_product_hint VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_item_record RECORD;
    v_old_value JSONB;
    v_sql_query TEXT;
    v_sql_params JSONB;
    v_nlp_interpretation TEXT;
    v_field_display_name TEXT;
BEGIN
    -- Get item record
    SELECT i.*, s.label as section_label, s.id as section_id
    INTO v_item_record
    FROM items i
    JOIN sections s ON i.section_id = s.id
    WHERE i.id = p_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % does not exist', p_item_id;
    END IF;
    
    -- VALIDATION: Check expected_product_hint if provided
    IF p_expected_product_hint IS NOT NULL THEN
        IF LOWER(v_item_record.product) NOT LIKE '%' || LOWER(p_expected_product_hint) || '%' 
           AND LOWER(p_expected_product_hint) NOT LIKE '%' || LOWER(v_item_record.product) || '%' THEN
            RAISE EXCEPTION 'Product mismatch: Expected item matching %, but found %', 
                p_expected_product_hint, v_item_record.product;
        END IF;
    END IF;
    
    -- Map field_name to actual column and get old value
    CASE p_field_name
        WHEN 'price_ttc' THEN
            v_old_value := to_jsonb(v_item_record.price_ttc);
            v_sql_query := 'UPDATE items SET price_ttc = :new_value, updated_at = NOW() WHERE id = :item_id';
            v_field_display_name := 'price (TTC)';
        WHEN 'price_ht_quote' THEN
            v_old_value := to_jsonb(v_item_record.price_ht_quote);
            v_sql_query := 'UPDATE items SET price_ht_quote = :new_value, updated_at = NOW() WHERE id = :item_id';
            v_field_display_name := 'price (HT)';
        WHEN 'product' THEN
            v_old_value := to_jsonb(v_item_record.product);
            v_sql_query := 'UPDATE items SET product = :new_value, updated_at = NOW() WHERE id = :item_id';
            v_field_display_name := 'product name';
        WHEN 'reference' THEN
            v_old_value := to_jsonb(v_item_record.reference);
            v_sql_query := 'UPDATE items SET reference = :new_value, updated_at = NOW() WHERE id = :item_id';
            v_field_display_name := 'reference';
        ELSE
            RAISE EXCEPTION 'Field % is not updatable through this function', p_field_name;
    END CASE;
    
    -- VALIDATION: Check if value actually changed
    IF v_old_value = p_new_value THEN
        RAISE EXCEPTION 'Update would result in no change for field %', p_field_name;
    END IF;
    
    -- Build SQL params
    v_sql_params := jsonb_build_object(
        'item_id', p_item_id,
        'new_value', p_new_value
    );
    
    -- Generate NLP interpretation
    IF p_field_name LIKE 'price%' THEN
        v_nlp_interpretation := format('Update %s for ''%s'' to €%s', v_field_display_name, v_item_record.product, p_new_value);
    ELSE
        v_nlp_interpretation := format('Update %s for ''%s'' from ''%s'' to ''%s''', 
            v_field_display_name, v_item_record.product, v_old_value, p_new_value);
    END IF;
    
    -- Return preview
    RETURN jsonb_build_object(
        'action', 'update_item_field',
        'item_id', p_item_id,
        'item_product', v_item_record.product,
        'section_id', v_item_record.section_id,
        'section_label', v_item_record.section_label,
        'field_path', p_field_name,
        'current_value', v_old_value,
        'new_value', p_new_value,
        'sql', jsonb_build_object(
            'query', v_sql_query,
            'params', v_sql_params
        ),
        'nlp', v_nlp_interpretation,
        'affected_items', jsonb_build_array(
            jsonb_build_object(
                'id', p_item_id,
                'product', v_item_record.product,
                'section', v_item_record.section_label
            )
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Execute update_item_field (called after confirmation)
CREATE OR REPLACE FUNCTION execute_update_item_field(
    p_item_id INTEGER,
    p_field_name VARCHAR,
    p_new_value JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_value JSONB;
BEGIN
    -- Get old value for edit history
    CASE p_field_name
        WHEN 'price_ttc' THEN
            SELECT to_jsonb(price_ttc) INTO v_old_value FROM items WHERE id = p_item_id;
            UPDATE items SET price_ttc = (p_new_value)::numeric, updated_at = NOW() WHERE id = p_item_id;
        WHEN 'price_ht_quote' THEN
            SELECT to_jsonb(price_ht_quote) INTO v_old_value FROM items WHERE id = p_item_id;
            UPDATE items SET price_ht_quote = (p_new_value)::numeric, updated_at = NOW() WHERE id = p_item_id;
        WHEN 'product' THEN
            SELECT to_jsonb(product) INTO v_old_value FROM items WHERE id = p_item_id;
            -- Extract text value from JSONB without quotes
            UPDATE items SET product = (p_new_value#>>'{}'), updated_at = NOW() WHERE id = p_item_id;
        WHEN 'reference' THEN
            SELECT to_jsonb(reference) INTO v_old_value FROM items WHERE id = p_item_id;
            -- Extract text value from JSONB without quotes: use ->> operator or #>>'{}'
            UPDATE items SET reference = (p_new_value#>>'{}'), updated_at = NOW() WHERE id = p_item_id;
        ELSE
            RAISE EXCEPTION 'Field % is not updatable', p_field_name;
    END CASE;
    
    -- Log edit history
    INSERT INTO edit_history (item_id, field_path, old_value, new_value, source)
    VALUES (p_item_id, p_field_name, v_old_value, p_new_value, 'agent');
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update item field';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

