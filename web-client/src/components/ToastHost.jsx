import { useEffect, useState } from "react";
import { onToast, toast } from "../api";

/** Kurze Rückmeldungen ("Gespeichert", "Gelöscht" ...) unten rechts, verschwinden nach 3 Sekunden von selbst. */
export function ToastHost() {
    const [items, setItems] = useState([]);
    useEffect(
        () =>
            onToast(({ message, type }) => {
                const id = Math.random();
                setItems((list) => [...list, { id, message, type }]);
                setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 3000);
            }),
        [],
    );
    if (!items.length) return null;
    return (
        <div className="toasts" role="status" aria-live="polite">
            {items.map((t) => (
                <div key={t.id} className={"toast " + t.type}>{t.message}</div>
            ))}
        </div>
    );
}
