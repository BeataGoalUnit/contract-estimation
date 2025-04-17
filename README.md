# Contract Estimation from Transfers

## Task
> "Ändra i databsen så att alla spelare som har lämnat som bosman har utgående kontrakt samt att alla spelare som lämnar som unknown transfer fee eller för given transferfee får ett estimerat kontrakt på minst 18 månader"

## Plan
- om transfer har transfer fee: sätt det tidigare kontraktets slutdatum till transferdatum + 18 månader, och nytt kontrakt börjar här
- om free transfer: sätt det tidigare kontraktets slutdatum till detta transferdatum, och nytt kontrakt börjar här
- om transfer var lån: ignorera
- om transfern var till without club: sätt detta som tidigare kontraktets slutdatum
- om transfern var från without club: nytt kontrakt börjar här