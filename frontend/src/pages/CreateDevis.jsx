import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';

// Default rooms will be initialized in the component to use translations

export default function CreateDevis() {
  const { t } = useTranslation();
  
  const getDefaultRooms = () => [
    { id: 'living-room', name: t('roomLivingRoom') || 'Living Room', actions: [] },
    { id: 'bedroom', name: t('roomBedroom') || 'Bedroom', actions: [] },
    { id: 'bathroom', name: t('roomBathroom') || 'Bathroom', actions: [] }
  ];
  
  const [rooms, setRooms] = useState(getDefaultRooms());
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const ACTION_TYPES = [
    { id: 'plumbing', label: t('devisPlumbing') || 'Plumbing' },
    { id: 'electrics', label: t('devisElectrics') || 'Electrics' },
    { id: 'destruction', label: t('devisDestruction') || 'Destruction/Building Walls' }
  ];

  const handleAddAction = (actionType) => {
    const actionLabel = ACTION_TYPES.find(a => a.id === actionType)?.label || actionType;
    
    if (selectedRoom) {
      // Add to selected room only
      setRooms(rooms.map(room => 
        room.id === selectedRoom
          ? { ...room, actions: [...room.actions, { type: actionType, label: actionLabel }] }
          : room
      ));
    } else {
      // Add to all rooms
      setRooms(rooms.map(room => ({
        ...room,
        actions: [...room.actions, { type: actionType, label: actionLabel }]
      })));
    }
    
    setShowDropdown(false);
  };

  const handleRemoveAction = (roomId, actionIndex) => {
    setRooms(rooms.map(room =>
      room.id === roomId
        ? { ...room, actions: room.actions.filter((_, idx) => idx !== actionIndex) }
        : room
    ));
  };

  const handleAddRoom = () => {
    const roomName = prompt('Enter room name:');
    if (roomName && roomName.trim()) {
      const newRoom = {
        id: `room-${Date.now()}`,
        name: roomName.trim(),
        actions: []
      };
      setRooms([...rooms, newRoom]);
    }
  };

  const handleRemoveRoom = (roomId) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter(room => room.id !== roomId));
      if (selectedRoom === roomId) {
        setSelectedRoom(null);
      }
    } else {
      alert('Cannot remove the last room');
    }
  };

  return (
    <div className="create-devis-page">
      <header className="content-header">
        <div>
          <h2>{t('createDevisTitle') || 'Create Devis'}</h2>
          <p>{t('createDevisSubtitle') || 'Build your renovation estimate by adding actions to rooms'}</p>
        </div>
      </header>

      <div className="devis-controls">
        <div className="action-dropdown-container">
          <button
            className="action-dropdown-toggle"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {t('addAction') || 'Add Action'} {showDropdown ? '▲' : '▼'}
          </button>
          
          {showDropdown && (
            <div className="action-dropdown-menu">
              {ACTION_TYPES.map(action => (
                <button
                  key={action.id}
                  className="action-dropdown-item"
                  onClick={() => handleAddAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="room-selector">
          <label>
            {t('selectRoom') || 'Select Room'}:
            <select
              value={selectedRoom || ''}
              onChange={(e) => setSelectedRoom(e.target.value || null)}
              className="room-select"
            >
              <option value="">{t('allRooms') || 'All Rooms'}</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="add-room-btn"
          onClick={handleAddRoom}
        >
          {t('addRoom') || '+ Add Room'}
        </button>
      </div>

      <div className="rooms-grid">
        {rooms.map(room => (
          <div key={room.id} className="room-card">
            <div className="room-card-header">
              <h3>{room.name}</h3>
              <button
                className="remove-room-btn"
                onClick={() => handleRemoveRoom(room.id)}
                title={t('removeRoom') || 'Remove room'}
              >
                ×
              </button>
            </div>
            
            <div className="room-actions">
              {room.actions.length === 0 ? (
                <p className="no-actions">{t('noActions') || 'No actions added yet'}</p>
              ) : (
                room.actions.map((action, index) => (
                  <div key={index} className="action-item">
                    <span className="action-label">{action.label}</span>
                    <button
                      className="remove-action-btn"
                      onClick={() => handleRemoveAction(room.id, index)}
                      title={t('removeAction') || 'Remove action'}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

