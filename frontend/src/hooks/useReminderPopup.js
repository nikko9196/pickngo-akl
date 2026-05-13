import { useEffect, useState } from "react";

export function useReminderPopup(socketRef, currentUserIdRef) {
    const [showReminderPopup, setShowReminderPopup] = useState(false);
    const [remindedUserIds, setRemindedUserIds] = useState([]);

    useEffect(() => {
        if (!socketRef?.current) return;

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

        socketRef.current.on("reminder_sent", handler);

        return () => {
            socketRef.current.off("reminder_sent", handler);
        };
    }, [socketRef.current]);

    return {
        showReminderPopup,
        setShowReminderPopup,
        remindedUserIds,
        setRemindedUserIds
    };
}