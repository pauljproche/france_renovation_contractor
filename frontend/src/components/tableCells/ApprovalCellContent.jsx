import { EditableCellContent } from './EditableCellContent.jsx';

const ALLOWED_STATUSES = ['approved', 'change_order', 'pending', 'rejected', 'supplied_by'];

/**
 * Component for editing approval status and notes together
 */
export function ApprovalCellContent({ statusValue, statusField, noteValue, noteField, onUpdate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <EditableCellContent
        value={statusValue}
        field={statusField}
        onUpdate={onUpdate}
        type="select"
        options={ALLOWED_STATUSES}
      />
      <EditableCellContent
        value={noteValue}
        field={noteField}
        onUpdate={onUpdate}
        type="text"
      />
    </div>
  );
}

