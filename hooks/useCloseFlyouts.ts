/**
 * Custom hook to trigger closing all open flyout panels
 */
export function useCloseFlyouts() {
    const closeFlyouts = () => {
        // Dispatch custom event to close all flyouts
        window.dispatchEvent(new CustomEvent('closeFlyouts'));
    };

    return { closeFlyouts };
}

/**
 * Custom hook to listen for flyout close events
 */
export function useListenCloseFlyouts(callback: () => void) {
    if (typeof window === 'undefined') return;

    const handleClose = () => {
        callback();
    };

    window.addEventListener('closeFlyouts', handleClose);

    return () => {
        window.removeEventListener('closeFlyouts', handleClose);
    };
}
