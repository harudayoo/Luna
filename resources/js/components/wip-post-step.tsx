import { Check, Copy, ExternalLink, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useClipboard } from '@/hooks/use-clipboard';

/**
 * The done step after logging your own late or leave: the message Luna wrote for WIP's OCS Attendance
 * channel, editable, with Copy and open, Reword (a new wording), Copy and Done.
 */
export function WipPostStep({
    id,
    message,
    onChange,
    wipUrl,
    onReword,
    onDone,
}: {
    id: string;
    message: string;
    onChange: (m: string) => void;
    wipUrl: string;
    onReword: () => void;
    onDone: () => void;
}) {
    const [copied, copy] = useClipboard();

    const openWip = () => {
        void copy(message);
        window.open(wipUrl, '_blank', 'noopener');
    };

    return (
        <div className="grid gap-4">
            <DialogTitle>Logged. Now tell the office on WIP</DialogTitle>
            <DialogDescription>
                Post it in the OCS Attendance channel. Luna wrote it for you;
                change anything, or reword it.
            </DialogDescription>
            <label htmlFor={id} className="sr-only">
                Message for WIP
            </label>
            {/* Grows with the text (leave messages run longer); 4 rows where field-sizing isn't supported. */}
            <textarea
                id={id}
                rows={4}
                value={message}
                onChange={(e) => onChange(e.target.value)}
                className="field-sizing-content min-h-28 w-full resize-y bg-surface-hover p-4 text-base text-ink focus-visible:shadow-lift focus-visible:outline-none md:text-sm"
            />
            <Button
                onClick={openWip}
                className="w-full"
                disabled={message.trim() === ''}
            >
                <ExternalLink /> Copy and open #attendance
            </Button>
            <div className="grid grid-cols-3 gap-2">
                {/* Writes a new message: the kit's code button (decode). Its "> " prompt and mono
                    font are wider, so on phones (a third of the width) the icon gives way. */}
                <Button
                    variant="code"
                    className="px-2"
                    icon={<Shuffle className="hidden sm:block" />}
                    onClick={onReword}
                >
                    Reword
                </Button>
                <Button
                    variant="secondary"
                    className="bg-bg px-2"
                    onClick={() => void copy(message)}
                >
                    {copied === message ? <Check /> : <Copy />}
                    {copied === message ? 'Copied' : 'Copy'}
                </Button>
                <Button
                    variant="secondary"
                    className="bg-bg px-2"
                    onClick={onDone}
                >
                    Done
                </Button>
            </div>
        </div>
    );
}
