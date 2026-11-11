import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { resolvedAppearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={resolvedAppearance}
            className="toaster group"
            position="bottom-right"
            style={
                {
                    '--normal-bg': 'var(--surface)',
                    '--normal-text': 'var(--ink)',
                    '--normal-border': 'transparent',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
