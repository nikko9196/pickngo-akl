import './ReminderPopup.css';

export default function ReminderPopup({ isHost, onClose }) {
    return (
        <div className="wp-overlay">
            <div className="wp-popup">
                <p className="wp-popup-text">🔔 REMINDER</p>

                <p className="wp-popup-subtitle">
                    {isHost
                        ? "You reminded yourself to get ready!"
                        : "You have been reminded to get ready!"}
                </p>

                <button
                    className="reminder-button"
                    onClick={onClose}
                >
                    GOT IT
                </button>
            </div>
        </div>
    );
}