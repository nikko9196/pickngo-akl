import { useNavigate } from "react-router-dom";

function RoomDeletedModal() {
  const navigate = useNavigate();

  return (
    <div className="room-deleted-backdrop" role="presentation">
      <section
        className="room-deleted-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-deleted-title"
      >
        <h2 id="room-deleted-title">Room deleted</h2>
        <p>This room has been deleted by the host.</p>
        <button type="button" onClick={() => navigate("/", { replace: true })}>
          Back to Home
        </button>
      </section>
    </div>
  );
}

export default RoomDeletedModal;
