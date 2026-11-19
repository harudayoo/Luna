<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The client companies and their WIP item boards, as the user listed them (2026-11-19). Admin keeps them up
 * under People -> Companies. Full names weren't given, so most start as their tag.
 */
return new class extends Migration
{
    private const W = 'https://wip.quicksilversystems.com/servers/';

    private const COMPANIES = [
        ['QSS', 'Quick Silver Systems', [['Items', '0ff1cecb-9617-41c8-995c-45338bba79c2/channels/c56eae0b-dabb-49d0-b1ce-6670d0582bba']]],
        ['STM', 'STM', [['Items', '685ec805-7db1-4014-a9ed-2750cbb4038d/channels/a66fff81-14d5-4521-a7a3-5af7273b555f']]],
        ['HDI', 'HDI', [['Items', '0bbe7ed9-6e86-4341-ab92-84a6e5bc7ca2/channels/8e53e96c-c9e3-4daa-9503-8d06fda82e16']]],
        ['SSI', 'SSI', [
            ['Equine Items', '15a115b6-5be4-4bab-9ba9-2f64ac53c9d8/channels/14ed4a88-af22-4dfe-a94f-1a08507b8ba1'],
            ['Farm Items', '15a115b6-5be4-4bab-9ba9-2f64ac53c9d8/channels/cb9cb420-13a8-474f-a7a5-1d0d935a213e'],
        ]],
        ['NPIA', 'NPIA', [['Items', '2426961c-abf8-40d4-b387-2159714178d2/channels/c30ab8b2-4580-4fb5-9953-e67ae24ea7f3']]],
        ['PAIC', 'PAIC', [['Items', '10ca8e3c-8744-4d95-ad05-cd1d95ce7c1c/channels/4f3c5ff0-7ec0-4410-8965-e30fc644558f']]],
        ['INS', 'INS', [
            ['Items', '3d2ac954-376c-422a-950b-16494aa1e1d4/channels/60b9fb9b-4347-4c95-bccd-f7bb881be347'],
            ['Changes', '3d2ac954-376c-422a-950b-16494aa1e1d4/channels/b25ab876-f178-4544-af83-b3e70d05c026'],
        ]],
        ['RLI', 'RLI', [
            ['Items', '0c31a8fc-94a7-4496-82c3-bec203de2311/channels/f6bc507d-a0a5-464a-8544-3e1b63e8737a'],
            ['Modifications', '0c31a8fc-94a7-4496-82c3-bec203de2311/channels/be84e97b-8738-4a47-ba5a-52bfdba8b3e7'],
        ]],
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::COMPANIES as [$tag, $name, $channels]) {
            if (DB::table('companies')->where('tag', $tag)->exists()) {
                continue;
            }

            $id = DB::table('companies')->insertGetId(['tag' => $tag, 'name' => $name, 'created_at' => $now, 'updated_at' => $now]);
            DB::table('company_channels')->insert(array_map(fn ($c) => [
                'company_id' => $id, 'name' => $c[0], 'url' => self::W.$c[1].'?selectedView=board',
                'created_at' => $now, 'updated_at' => $now,
            ], $channels));
        }
    }

    public function down(): void
    {
        // Channels go with their company (cascade).
        DB::table('companies')->whereIn('tag', array_column(self::COMPANIES, 0))->delete();
    }
};
