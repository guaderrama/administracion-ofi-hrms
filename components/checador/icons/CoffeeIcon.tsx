import React from 'react';

export const CoffeeIcon: React.FC<{ className?: string }> = ({ className = "h-10 w-10" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 18h2m-4-4v4a2 2 0 002 2h4a2 2 0 002-2v-4m-6 0V7a2 2 0 012-2h2a2 2 0 012 2v7m-6 0h6" />
    </svg>
);
