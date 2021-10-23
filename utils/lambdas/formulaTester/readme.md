# Live Formula Calculator
This folder contains the logic for the live data calculator for generating formula values **AND ALSO** for the the formula tester.

For the sake of time, this formula tester had been put together with the live data calculator. There will, however, be two seperate running lambda functions with requests triggering the corresponding lambda function. The reason is because there are places where the formula calculator was designed to store information as a class variable when not null. We want freshly sets of data for the formula tester. There are also other reasons...

This is also being maintained together for now so that needed fixes and changes get applied to both all at once. This is probably a temporary solution and we may want to seperate the logic at some point.

-----
The code has divereged. Right now the only difference is in how it's parsed on arrival due to SQS vs direct invokation