<?php

namespace Tests\Feature\Notifications;

use App\Models\Holiday;
use App\Models\Payslip;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * In-app notifications (spec 2026-11-24-luna-notifications): ten events, never sent to the person who acted.
 * "Today" is Thu 2026-11-12. Ana is an employee (60,000, PTO from Nov 1, so 3.33 h by Nov 15); Hana is HR.
 */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $admin;

    private User $ana;

    private User $ben;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-12 10:00:00');
        Setting::put('pto.accrual_mode', 'full');
        $this->hr = User::factory()->hr()->create(['name' => 'Hana Reyes']);
        $this->admin = User::factory()->admin()->create(['name' => 'Ada Admin']);
        $this->ana = $this->employee('Ana Cruz');
        $this->ben = $this->employee('Ben Santos');
    }

    private function employee(string $name): User
    {
        $user = User::factory()->create(['name' => $name, 'pto_start' => '2026-11-01']);
        $user->forceFill(['monthly_salary' => 60000, 'position' => 'Developer'])->save();

        return $user;
    }

    /** @return list<string> */
    private function kinds(User $user): array
    {
        return $user->fresh()->notifications()->get()->map(fn ($n) => $n->data['kind'])->sort()->values()->all();
    }

    private function payslipPayload(): array
    {
        return [
            'issued_on' => '2026-11-30', 'holiday_regular_days' => 0, 'holiday_special_days' => 0, 'absences' => 0,
            'overtime_allowance' => 0, 'sss' => 0, 'philhealth' => 0, 'pagibig' => 0, 'withholding_tax' => 0, 'cash_advance' => 0,
        ];
    }

    public function test_a_released_payslip_tells_its_owner()
    {
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), $this->payslipPayload())->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ben, '2026-11-01']), $this->payslipPayload())->assertSessionHasNoErrors();
        $ana = Payslip::query()->where('user_id', $this->ana->id)->sole();

        $this->actingAs($this->hr)->patch(route('people.payroll.release', $ana), ['released' => true])->assertSessionHasNoErrors();
        $this->assertSame(['payslip_released'], $this->kinds($this->ana));
        $this->assertSame([], $this->kinds($this->ben));
        $this->assertSame(route('payslips.print', $ana, false), $this->ana->notifications()->first()->data['url']);

        // Mark all received tells only the ones it releases.
        $this->actingAs($this->hr)->post(route('people.payroll.release.all'), ['cutoff' => '2026-11-01'])->assertSessionHasNoErrors();
        $this->assertSame(['payslip_released'], $this->kinds($this->ana));
        $this->assertSame(['payslip_released'], $this->kinds($this->ben));
        $this->assertSame([], $this->kinds($this->hr));
    }

    public function test_hr_logging_leave_for_someone_tells_them_and_not_hr()
    {
        $this->actingAs($this->hr)->post(route('people.leave.store', $this->ana), ['from' => '2026-11-10', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '15:00'])
            ->assertSessionHasNoErrors();

        $this->assertSame(['leave_for_you'], $this->kinds($this->ana));
        $this->assertSame([], $this->kinds($this->hr));
        $this->assertSame([], $this->kinds($this->admin));   // HR acted: no "leave logged" for HR
    }

    public function test_an_employee_logging_leave_tells_hr_and_admin()
    {
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-13', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '15:00'])->assertSessionHasNoErrors();

        $this->assertSame(['leave_logged'], $this->kinds($this->hr));
        $this->assertSame(['leave_logged'], $this->kinds($this->admin));
        $this->assertSame([], $this->kinds($this->ana));
        $this->assertSame([], $this->kinds($this->ben));
    }

    public function test_leave_beyond_the_balance_warns_the_employee_and_hr()
    {
        // 3.33 h by Nov 15, a whole day is 8 h: 4.67 h unpaid.
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-13'])->assertSessionHasNoErrors();

        $this->assertSame(['leave_unpaid'], $this->kinds($this->ana));
        $this->assertSame(['leave_logged', 'leave_unpaid_hr'], $this->kinds($this->hr));
        $this->assertStringContainsString('4.67 h', $this->ana->notifications()->first()->data['body']);
    }

    public function test_a_holiday_change_tells_everyone_but_the_one_who_made_it()
    {
        $this->actingAs($this->hr)->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Office day off', 'kind' => 'special'])
            ->assertSessionHasNoErrors();
        $holiday = Holiday::query()->where('name', 'Office day off')->sole();
        $this->actingAs($this->hr)->patch(route('people.holidays.update', $holiday), ['date' => '2026-11-27', 'name' => 'Office day off', 'kind' => 'special'])
            ->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->delete(route('people.holidays.destroy', $holiday))->assertSessionHasNoErrors();

        $this->assertSame(['holiday', 'holiday', 'holiday'], $this->kinds($this->ana));
        $this->assertSame(['holiday', 'holiday', 'holiday'], $this->kinds($this->admin));
        $this->assertSame([], $this->kinds($this->hr));
    }

    public function test_a_pay_schedule_change_tells_everyone()
    {
        $this->actingAs($this->admin)->put(route('people.formulas.frequency'), ['frequency' => 'semi_monthly', 'from' => '2027-01'])
            ->assertSessionHasNoErrors();

        $this->assertSame(['pay_schedule'], $this->kinds($this->ana));
        $this->assertSame(['pay_schedule'], $this->kinds($this->hr));
        $this->assertSame([], $this->kinds($this->admin));
    }

    public function test_a_declared_late_tells_hr()
    {
        $this->actingAs($this->ana)->post(route('time.lates.store'), [
            'date' => '2026-11-12', 'kind' => 'late_in', 'start_time' => '09:00', 'end_time' => '09:20', 'note' => 'Traffic',
        ])->assertSessionHasNoErrors();

        $this->assertSame(['late_declared'], $this->kinds($this->hr));
        $this->assertSame([], $this->kinds($this->ana));
    }

    public function test_an_accepted_invite_tells_hr()
    {
        $new = User::factory()->invited()->create(['name' => 'Nina New']);

        $this->post($new->inviteUrl(), ['password' => 'a-good-password', 'password_confirmation' => 'a-good-password'])
            ->assertRedirect(route('dashboard'));

        $this->assertSame(['joined'], $this->kinds($this->hr));
        $this->assertSame(['joined'], $this->kinds($this->admin));
        $this->assertSame([], $this->kinds($this->ana));
        $this->assertSame([], $this->kinds($new));
    }

    public function test_hr_is_reminded_once_near_period_end_about_unreleased_payslips()
    {
        $this->actingAs($this->hr)->get(route('dashboard'))->assertOk();
        $this->assertSame([], $this->kinds($this->hr));   // Nov 12: not yet

        $this->travelTo('2026-11-28 09:00:00');
        $this->actingAs($this->hr)->get(route('dashboard'))->assertOk();
        $this->actingAs($this->hr)->get(route('dashboard'))->assertOk();
        $this->assertSame(['payslips_due'], $this->kinds($this->hr));
        $this->assertStringContainsString('2 of 2', $this->hr->notifications()->first()->data['body']);

        $this->actingAs($this->ana)->get(route('dashboard'))->assertOk();
        $this->assertSame([], $this->kinds($this->ana));
    }

    public function test_opening_marks_read_and_goes_to_its_page()
    {
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-13', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '15:00']);
        $notice = $this->hr->notifications()->first();

        $this->actingAs($this->ana)->get(route('notifications.open', $notice->id))->assertNotFound();
        $this->actingAs($this->hr)->get(route('notifications.open', $notice->id))->assertRedirect($notice->data['url']);
        $this->assertNotNull($notice->fresh()->read_at);
    }

    public function test_read_all_clears_the_count()
    {
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-13', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '15:00']);
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-16', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '15:00']);
        $this->assertSame(2, $this->hr->unreadNotifications()->count());

        $this->actingAs($this->hr)->post(route('notifications.read-all'))->assertRedirect();
        $this->assertSame(0, $this->hr->unreadNotifications()->count());
    }

    public function test_the_shared_prop_carries_the_count_items_and_module_dots()
    {
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-13', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '15:00']);

        $this->actingAs($this->hr)->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page
                ->where('notifications.unread', 1)
                ->where('notifications.items.0.kind', 'leave_logged')
                ->where('notifications.items.0.read', false)
                ->has('notifications.items.0.ago')
                ->where('notifications.modules.people', 1));

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->where('notifications.unread', 0)->where('notifications.items', []));
    }

    public function test_the_migration_goes_up_and_down()
    {
        $migration = require database_path('migrations/2026_11_24_000024_create_notifications_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasTable('notifications'));
        $migration->up();
        $this->assertTrue(Schema::hasTable('notifications'));
    }
}
