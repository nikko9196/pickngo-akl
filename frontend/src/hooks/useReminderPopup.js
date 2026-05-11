import { useEffect, useState, useRef } from "react";

export function useReminderPopup(socket, currentUserIdRef) {
    const [showReminderPopup, setShowReminderPopup] = useState(false);
    const [remindedUserIds, setRemindedUserIds] = useState([]);

    useEffect(() => {
        if (!socket) return;

        const handler = (remindedUserIds) => {
            setRemindedUserIds(remindedUserIds);

            const userId = currentUserIdRef?.current;

            if (
                userId &&
                remindedUserIds?.map(String).includes(String(userId))
            ) {
                setShowReminderPopup(true);
            }
        };

        socket.on("reminder_sent", handler);

        return () => {
            socket.off("reminder_sent", handler);
        };
    }, [socket]);

    return {
        showReminderPopup,
        setShowReminderPopup,
        remindedUserIds,
        setRemindedUserIds
    };
}