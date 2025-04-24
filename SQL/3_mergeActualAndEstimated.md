~~~~sql
WITH matched_actuals AS (
 -- Step 1: Try to match estimated contracts to actual ones that are missing start or end
 SELECT
   a.playerId,
   a.clubId,
   a.clubName,
   a.actualContractStart,
   a.actualContractEnd,

    -- If actual normalized start is null, use estimated
   CASE
     WHEN a.normalizedContractStart IS NULL THEN e.normalizedContractStart
     ELSE a.normalizedContractStart
   END AS normalizedContractStart,


   -- If actual normalized end is null, use estimated
   CASE
     WHEN a.normalizedContractEnd IS NULL THEN e.normalizedContractEnd
     ELSE a.normalizedContractEnd
   END AS normalizedContractEnd,
   a.numContractsInPeriod,


   -- Bring in estimated values (if exists)
   e.contractStart AS estimatedContractStart,
   e.contractEnd AS estimatedContractEnd


 FROM `goalunit-404013.contractestimation.actualUpd` a
 LEFT JOIN `goalunit-404013.contractestimation.estimated` e
   ON a.playerId = e.playerId
   AND a.clubId = e.clubId
   AND (
     a.normalizedContractStart = e.normalizedContractStart OR
     a.normalizedContractEnd = e.normalizedContractEnd
   )
),


estimated_only AS (
 -- Step 2: Find estimated contracts with no matching actual entry
 SELECT
   e.playerId,
   e.clubId,
   e.clubName,
   CAST(NULL AS DATE) AS actualContractStart,
   CAST(NULL AS DATE) AS actualContractEnd,
   e.normalizedContractStart,
   e.normalizedContractEnd,
   CAST(NULL AS INT64) AS numContractsInPeriod,
   e.contractStart AS estimatedContractStart,
   e.contractEnd AS estimatedContractEnd


 FROM `goalunit-404013.contractestimation.estimated` e
 LEFT JOIN `goalunit-404013.contractestimation.actualUpd` a
   ON e.playerId = a.playerId
   AND e.clubId = a.clubId
   AND (
     e.normalizedContractStart = a.normalizedContractStart OR
     e.normalizedContractEnd = a.normalizedContractEnd
   )
 WHERE a.playerId IS NULL
)


-- Step 3: Combine both sets and order the results
SELECT * FROM matched_actuals
UNION ALL
SELECT * FROM estimated_only
ORDER BY playerId, normalizedContractStart, normalizedContractEnd;
~~~~