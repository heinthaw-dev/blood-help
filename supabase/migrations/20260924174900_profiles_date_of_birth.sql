-- Date of birth for donors, captured on the donor profile setup form.
--
-- Nullable on purpose: a profiles row is created at OTP verification with only
-- id + phone (App.tsx handleVerified), long before donor setup runs, and
-- requesters who never donate never supply a DOB. "Required" is enforced in the
-- donor form; the DB enforces the age rule on whatever value arrives.
alter table public.profiles
  add column if not exists date_of_birth date;

-- 18+ is the Myanmar blood-donation minimum. Dump-safe: donors only get older,
-- so a row that satisfies this today satisfies it forever.
alter table public.profiles
  add constraint profiles_date_of_birth_age_check
  check (
    date_of_birth is null
    or (
      date_of_birth <= (current_date - interval '18 years')::date
      and date_of_birth >= date '1900-01-01'
    )
  );

comment on column public.profiles.date_of_birth is
  'Donor date of birth (18+ enforced by profiles_date_of_birth_age_check). Null for profiles created at auth that have not completed donor setup. Never exposed by callable_donors_for_request.';
