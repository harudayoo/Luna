import { Form, Head } from "@inertiajs/react";
import { useState } from "react";
import PolicyController from "@/actions/App/Http/Controllers/PolicyController";
import InputError from "@/components/input-error";
import { PeopleTabs } from "@/components/people-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { policy as policyRoute } from "@/routes/people";

type Props = {
    policy: {
        accrual_mode: string;
        accrual_hours: number;
        hours_per_day: number;
        monthly_cap_days: number;
        office_started_on: string;
    };
    modes: { value: string; label: string }[];
};

const HINTS: Record<string, string> = {
    full: "Everyone earns the full amount every cut-off, even with leave in it.",
    unpaid: "Days covered by PTO still earn PTO; unpaid hours earn nothing, so that cut-off’s accrual is prorated.",
    all: "Any leave hour earns nothing; accrual is prorated by hours actually worked in the cut-off.",
    forfeit:
        "Any leave in a cut-off, even part of a day, loses that whole cut-off’s hours. Leave on a holiday doesn’t count.",
};

/** The office leave policy: one set of rules that applies to everyone. */
export default function Policy({ policy, modes }: Props) {
    const [mode, setMode] = useState(policy.accrual_mode);

    return (
        <>
            <Head title="Leave policy" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Leave policy</h2>
            <PeopleTabs />

            <Form
                {...PolicyController.update.form()}
                className="ocs-card grid max-w-xl gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <p className="text-sm text-muted">
                            These rules apply to everyone, and every balance is
                            recalculated with them straight away.
                        </p>

                        <div className="grid gap-2">
                            <Label htmlFor="accrual_mode">
                                Accrual on leave
                            </Label>
                            <Select
                                name="accrual_mode"
                                value={mode}
                                onValueChange={setMode}
                            >
                                <SelectTrigger
                                    id="accrual_mode"
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {modes.map((m) => (
                                        <SelectItem
                                            key={m.value}
                                            value={m.value}
                                        >
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted">{HINTS[mode]}</p>
                            <InputError message={errors.accrual_mode} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="accrual_hours">
                                    Hours earned per cut-off
                                </Label>
                                <Input
                                    id="accrual_hours"
                                    name="accrual_hours"
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min="0"
                                    defaultValue={policy.accrual_hours}
                                    required
                                />
                                <p className="text-xs text-muted">
                                    3.3333 a cut-off is 6.67 hours a month.
                                </p>
                                <InputError message={errors.accrual_hours} />
                            </div>
                            <div className="grid content-start gap-2">
                                <Label htmlFor="monthly_cap_days">
                                    Most days off per month
                                </Label>
                                <Input
                                    id="monthly_cap_days"
                                    name="monthly_cap_days"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    min="0.5"
                                    defaultValue={policy.monthly_cap_days}
                                    required
                                />
                                <InputError message={errors.monthly_cap_days} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="office_started_on">
                                Office started on
                            </Label>
                            <Input
                                id="office_started_on"
                                name="office_started_on"
                                type="date"
                                defaultValue={policy.office_started_on}
                                required
                            />
                            <p className="text-xs text-muted">
                                PTO accrues from this date for anyone without
                                their own start date.
                            </p>
                            <InputError message={errors.office_started_on} />
                        </div>

                        <p className="text-xs text-muted">
                            Cut-offs are the 1st–15th and the 16th–month end. A
                            full day of leave is {policy.hours_per_day} hours.
                        </p>

                        <Button
                            type="submit"
                            disabled={processing}
                            className="justify-self-start"
                        >
                            {processing && <Spinner />}
                            Save policy
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

Policy.layout = {
    breadcrumbs: [{ title: "Leave policy", href: policyRoute() }],
};
