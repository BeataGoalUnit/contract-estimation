~~~~sql
WITH contracts AS (
 SELECT *
 FROM `goalunit-404013.contractestimation.playerContract`
 WHERE playerId IN (229290, 202073, 78624, 78783, 30529)
   AND (isLoan = false OR isLoan IS NULL)
),

-- Normalize dates and choose what to keep from contracts
normalized_contracts AS (
 SELECT
   c.playerId,
   c.clubId,
   club.clubName,

   -- Normalize start date
   (
     SELECT date
     FROM UNNEST([
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractSigned, YEAR)) - 1),
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractSigned, YEAR)) + 180),
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractSigned, YEAR)) + 364),
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractSigned, YEAR)) + 545)
     ]) AS date
     ORDER BY ABS(DATE_DIFF(c.contractSigned, date, DAY))
     LIMIT 1
   ) AS normalizedContractStart,

   -- Normalize end date
   (
     SELECT date
     FROM UNNEST([
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractExpiration, YEAR)) - 1),
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractExpiration, YEAR)) + 180),
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractExpiration, YEAR)) + 364),
       DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractExpiration, YEAR)) + 545)
     ]) AS date
     ORDER BY ABS(DATE_DIFF(c.contractExpiration, date, DAY))
     LIMIT 1
   ) AS normalizedContractEnd,

   c.contractSigned,
   c.contractExpiration,
   c.playerJoined

 FROM contracts c
 LEFT JOIN `goalunit-404013.contractestimation.club` club
   ON c.clubId = club.clubId
),

-- Filter out contracts that ONLY has start or end date, if we already have a COMPLETE contract with same start or end.
filtered AS (
 SELECT nc.*
 FROM normalized_contracts nc
 LEFT JOIN normalized_contracts nc_complete
   ON nc.playerId = nc_complete.playerId
   AND nc.clubId = nc_complete.clubId
   AND nc_complete.normalizedContractStart IS NOT NULL
   AND nc_complete.normalizedContractEnd IS NOT NULL
   AND (
     (nc.normalizedContractStart IS NULL AND nc.normalizedContractEnd = nc_complete.normalizedContractEnd) OR
     (nc.normalizedContractEnd IS NULL AND nc.normalizedContractStart = nc_complete.normalizedContractStart)
   )
 WHERE nc_complete.playerId IS NULL  -- keep only if no more complete match found
),

-- Merge contracts that have same time period, playerId and clubId
grouped AS (
 SELECT
   playerId,
   clubId,
   clubName,
   playerJoined,
   normalizedContractStart,
   normalizedContractEnd,
   MIN(contractSigned) AS actualContractStart,
   MAX(contractExpiration) AS actualContractEnd,
   COUNT(*) AS numContractsInPeriod
 FROM filtered
 GROUP BY playerId, clubId, clubName, playerJoined, normalizedContractStart, normalizedContractEnd
)


SELECT *
FROM grouped
ORDER BY playerId, normalizedContractStart;
~~~~