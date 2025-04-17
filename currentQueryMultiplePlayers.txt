~~~~sql
WITH ordered_transfers AS (
SELECT *,
  ROW_NUMBER() OVER (PARTITION BY playerId ORDER BY transferredAt) AS transferRank
FROM `goalunit-404013.contractestimation.transfers`
WHERE isLoan = FALSE AND wasLoan = FALSE
  AND playerId IN (229290, 202073, 78624, 78783, 30529) -- Here should use all in allvsvenskan
),
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
   AND (next.transferFee > 0 OR next.isFreeTransfer = TRUE OR next.toNoClub = TRUE)
 QUALIFY ROW_NUMBER() OVER (PARTITION BY curr.playerId, curr.transferredAt ORDER BY next.transferredAt) = 1
),

contracts AS (
SELECT
  playerId,
  toClubId AS clubId,
  transferredAt AS contractStart,
  CASE
    WHEN nextIsFreeTransfer = TRUE THEN nextTransferDate
    WHEN nextToNoClub = TRUE THEN nextTransferDate
    WHEN nextTransferFee > 0 THEN DATE_ADD(nextTransferDate, INTERVAL 18 MONTH)
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
  transferFee > 0 OR fromNoClub = TRUE OR isFreeTransfer = TRUE
),

-- Phantom contract for the first transfer with a transfer fee
phantom_contract AS (
SELECT
  playerId,
  NULL AS clubId,  -- No club information for this phantom contract
  CAST(NULL AS DATE) AS contractStart,  -- NULL contract start, explicitly cast to DATE
  DATE_ADD(MIN(transferredAt), INTERVAL 18 MONTH) AS contractEnd,  -- 18 months after the first transfer
  FALSE AS isFreeTransfer,
  FALSE AS wasLoan,
  FALSE AS isLoan,
  FALSE AS fromNoClub,
  FALSE AS toNoClub,
  NULL AS transferFee,  -- No transfer fee for the phantom contract
  NULL AS seasonId
FROM ordered_transfers
WHERE transferRank = 1 AND transferFee > 0  -- First transfer with a transfer fee
GROUP BY playerId  -- Fix the aggregation issue
)

-- Join the calculatedContracts with playerContracts to assign playerContractId
-- Final query with club join
SELECT
c.*,
club.clubName,
pc.playerContractId,  -- Include playerContractId from playerContracts when conditions match
pc.contractExpiration AS actualContractEnd,
-- For contractStart
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

-- Normalize finalContractEnd
-- For contractEnd
(
SELECT date
FROM UNNEST([
  DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(COALESCE(pc.contractExpiration, c.contractEnd), YEAR)) - 1),         -- prev_dec31
  DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(COALESCE(pc.contractExpiration, c.contractEnd), YEAR)) + 180),       -- curr_june30
  DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(COALESCE(pc.contractExpiration, c.contractEnd), YEAR)) + 364),       -- curr_dec31
  DATE_FROM_UNIX_DATE(UNIX_DATE(DATE_TRUNC(COALESCE(pc.contractExpiration, c.contractEnd), YEAR)) + 545)        -- next_june30
]) AS date
ORDER BY ABS(DATE_DIFF(COALESCE(pc.contractExpiration, c.contractEnd), date, DAY))
LIMIT 1
) AS normalizedContractEnd

FROM (
-- Phantom contract to set end date
SELECT *
FROM phantom_contract
UNION ALL
-- Contracts from transfer data
SELECT *
FROM contracts
) c
LEFT JOIN `goalunit-404013.contractestimation.club` club  -- Join with the club table to get clubName
ON c.clubId = club.clubId
LEFT JOIN `goalunit-404013.contractestimation.playerContract` pc  -- Join with playerContracts to get playerContractId based on clubId and seasonId
ON c.playerId = pc.playerId
AND c.clubId = pc.clubId
AND c.seasonId = pc.seasonId
ORDER BY c.playerId, c.contractStart;
~~~~