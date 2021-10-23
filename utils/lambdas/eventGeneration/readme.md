# Event Generation Logic
The various programs/lambdas that handle event generation

## backfillEnqueuer
Lambda that runs as scheduled and feeds 'backfillRefresh'

## backfillRefresh
Lambda that handles recalculating events after backfilled data has arrived. Is fed by 'backfillEnqueuer'

## cleanRefresh
Refresh logic to be run locally by developer. Works best when there are no events and runs much faster than the regular 'refresh'

## liveEventGen
Lambda that hanldes live event generation

## oldPython
Old python files that our new logic is based off. We can probably discard this files as they are not used anywhere.

## refresh
Refresh logic to be runned locally by developer. Runs significantly slower than 'cleanRefresh' because it will check the database for events. This is essentially a recalculation.

# Notes
- There appears there may be a bug that primary effects the regular 'refresh' because of the difference between the actual vs expected structure of chunks of events (no date). This can mostly be addressed within just even generation logic by pulling chunks' dates using available id. There is a potential problem however to consider for data that may come from other formulas vs data that is raw pi data.