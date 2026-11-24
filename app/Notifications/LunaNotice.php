<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * One in-app notice in Luna's bell (database channel only: production mail is log-only).
 * $module is a key from resources/js/modules.ts, so the Bloom dock can dot that tile; null for none.
 */
class LunaNotice extends Notification
{
    public function __construct(
        public string $kind,
        public string $title,
        public string $body,
        public string $url,
        public ?string $module = null,
        /** @var array<string, string> Anything else to keep with it (payslips_due keeps its period). */
        public array $extra = [],
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, string|null> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'module' => $this->module,
        ] + $this->extra;
    }
}
