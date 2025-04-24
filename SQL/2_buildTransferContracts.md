~~~~sql
-- Step 1: Get all non-loan transfers for selected players, ordered chronologically per player
WITH ordered_transfers AS (
SELECT *,
 ROW_NUMBER() OVER (PARTITION BY playerId ORDER BY transferredAt) AS transferRank
FROM `goalunit-404013.contractestimation.transfers`
WHERE isLoan = FALSE AND wasLoan = FALSE
 AND playerId IN (229290, 202073, 78624, 78783, 30529)
),

-- Step 2: For each transfer, find the next non-loan transfer that meets criteria (free, toNoClub, or fee)
with_next AS (
SELECT
  curr.*,
  next.transferredAt AS nextTransferDate,
  next.transferFee AS nextTransferFee,
  next.isFreeTransfer AS nextIsFreeTransfer,
  next.toNoClub AS nextToNoClub
FROM ordered_transfers curr
LEFT JOIN ordered_transfers next
  ON curr.playerId = next.playerId
  AND next.transferredAt > curr.transferredAt
  AND next.isLoan = FALSE
  AND next.wasLoan = FALSE
  AND (
     next.transferFee > 0 OR
     next.isFreeTransfer = TRUE OR
     next.toNoClub = TRUE OR
     (next.transferFee = 0 AND next.isFreeTransfer = FALSE)
   )

-- Pick only the earliest such next valid transfer per current transfer
QUALIFY ROW_NUMBER() OVER (PARTITION BY curr.playerId, curr.transferredAt ORDER BY next.transferredAt) = 1
),

-- Step 3: Derive contract periods based on the current and next transfers
contracts AS (
SELECT
 playerId,
 toClubId AS clubId,
 transferredAt AS contractStart,
 CASE
   WHEN nextIsFreeTransfer = TRUE THEN nextTransferDate
   WHEN nextToNoClub = TRUE THEN nextTransferDate
   WHEN nextTransferFee > 0 OR (nextTransferFee = 0 AND nextIsFreeTransfer = FALSE) THEN DATE_ADD(nextTransferDate, INTERVAL 18 MONTH)
   ELSE NULL
 END AS contractEnd,

 -- Metadata from this transfer
 isFreeTransfer,
 wasLoan,
 isLoan,
 fromNoClub,
 toNoClub,
 transferFee,
 toSeasonId AS seasonId

FROM with_next
WHERE
 transferFee > 0 OR
 fromNoClub = TRUE OR
 isFreeTransfer = TRUE OR
 (transferFee = 0 AND isFreeTransfer = FALSE AND toNoClub = FALSE)
),

-- Step 4: Create a "phantom contract" for the very first transfer if it has a fee
phantom_contract AS (
SELECT
 playerId,
 NULL AS clubId,  -- No club information for this phantom contract
 CAST(NULL AS DATE) AS contractStart,
 DATE_ADD(MIN(transferredAt), INTERVAL 18 MONTH) AS contractEnd,  -- 18 months after the first transfer
 FALSE AS isFreeTransfer,
 FALSE AS wasLoan,
 FALSE AS isLoan,
 FALSE AS fromNoClub,
 FALSE AS toNoClub,
 NULL AS transferFee,
 NULL AS seasonId
FROM ordered_transfers
WHERE transferRank = 1 AND transferFee > 0
GROUP BY playerId
)

-- Step 5: Combine contracts and phantom contracts, join club names, and normalize contract dates
SELECT
c.*,
club.clubName,
(
SELECT date
FROM UNNEST([
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractStart, YEAR)) - 1),         -- prev_dec31
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractStart, YEAR)) + 180),       -- curr_june30
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractStart, YEAR)) + 364),       -- curr_dec31
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractStart, YEAR)) + 545)        -- next_june30
]) AS date
ORDER BY ABS(DATE_DIFF(c.contractStart, date, DAY))
LIMIT 1
) AS normalizedContractStart,

(
SELECT date
FROM UNNEST([
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractEnd, YEAR)) - 1),         -- prev_dec31
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractEnd, YEAR)) + 180),       -- curr_june30
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractEnd, YEAR)) + 364),       -- curr_dec31
 DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(c.contractEnd, YEAR)) + 545)        -- next_june30
]) AS date
ORDER BY ABS(DATE_DIFF(c.contractEnd, date, DAY))
LIMIT 1
) AS normalizedContractEnd

FROM (
SELECT *
FROM phantom_contract
UNION ALL
SELECT *
FROM contracts
) c
-- Join with club metadata
LEFT JOIN `goalunit-404013.contractestimation.club` club  -- Join with the club table to get clubName
ON c.clubId = club.clubId
ORDER BY c.playerId, c.contractStart;
~~~~