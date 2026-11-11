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
            // Top centre, under the 56px top bar: the bottom belongs to the Bloom dock.
            position="top-center"
            offset={{ top: 72 }}
            mobileOffset={{ top: 64 }}
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
