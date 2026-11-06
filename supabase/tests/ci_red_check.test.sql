begin;
select plan(1);
select ok(false, 'temporary: proves a failing pgTAP test fails CI');
select * from finish();
rollback;
