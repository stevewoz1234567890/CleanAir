# Formula Calculator Logic
This folder contains the logic for the formula value calculator. There are various files.

## altRefresh
An alternative refresh that was written to find a faster way to do full formula value refreshes. This is slower that anticipated and should not be used.

## backfillEnqueuer
Lambda logic that runs on a schedule once per day and feeds the backfill calculator.

## backfiller
Lambda logic that does the main backfilling refresh work as fed by the backfillEnqueuer

## liveCalculator
Lambda logic that handles live formula enableCalculations

## other
Other files and logic. Mostly temporary. May be removed.

## refresh
Lambda logic that handles developer invoked refresh

## remoteRefreshInvoker
Invoker for the 'refresh' logic. This invoker is intended for the developer only.
