import React, { useState, useEffect } from 'react';

export const CurrentTime: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <div className="text-right">
            <p className="text-2xl font-mono font-bold text-slate-800">
                {time.toLocaleTimeString('es-MX')}
            </p>
            <p className="text-sm text-slate-600">
                {time.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        </div>
    );
};
