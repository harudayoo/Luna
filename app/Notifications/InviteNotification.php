<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emails the set-password link. HR can also copy the same link from the People page,
 * so invites still work if the office has no mail server configured.
 */
class InviteNotification extends Notification
{
    public function __construct(private readonly User $invitedBy) {}

    /** @return array<int, string> */
    public function via(User $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('You\'re invited to Luna')
            ->greeting("Hi {$notifiable->name},")
            ->line("{$this->invitedBy->name} added you to Luna, the office app for leave, the shared calendar and payroll.")
            ->action('Set your password', $notifiable->inviteUrl())
            ->line('The link works for '.User::INVITE_DAYS.' days and only once.');
    }
}
