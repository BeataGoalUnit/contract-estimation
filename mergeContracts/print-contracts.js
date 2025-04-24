window.onload = function () {
  Promise.all([
    fetch("norm-estimated.json").then((res) => res.json()),
    fetch("norm-actual.json").then((res) => res.json()),
  ]).then(([estimatedRaw, actualRaw]) => {

    // Not for the scatter plot, but print an array of objects. One object for each player. Each player has a list of contracts. First, we check the actual contratcs. If that contract does not have an end or a start - we check corresponding estimated contract and uses that. Then we check if there are any estimated contracts that does not have corresponding actual contracts, if so - we add that to the list. Again - not to the plot, dont need x and y.

    const players = {};
    const addContract = (playerId, contract) => {
      if (!players[playerId]) {
        players[playerId] = { contracts: [] };
      }
      players[playerId].contracts.push(contract);
    };
    const addActualContract = (act) => {
      let start = act.normalizedContractStart;
      let end = act.normalizedContractEnd;
      // if no start - search in estimated for matching end
      if (!start && end) {
        const est = estimatedRaw.find(e =>
          e.playerId === act.playerId &&
          e.clubId === act.clubId &&
          e.normalizedContractEnd === end
        );
        if (est) {
          console.log('found start', est);
          start = est.normalizedContractStart;
        }
      }
      // if no end - search in estimated for matching start
      if (start && !end) {
        const est = estimatedRaw.find(e =>
          e.playerId === act.playerId &&
          e.clubId === act.clubId &&
          e.normalizedContractStart === start
        );
        if (est) {
          console.log('found end', est);
          end = est.normalizedContractEnd;
        }
      }
      if (!start && !end) return;
      addContract(act.playerId, {
        playerId: act.playerId,
        clubId: act.clubId,
        start,
        end,
        type: "actual",
        seasonId: act.seasonId,
        raw: act
      });
    };

    // now loop through estimated contracts - see if there are gaps in actual contracts
    const addEstimatedContract = (est) => {
      let start = est.normalizedContractStart;
      let end = est.normalizedContractEnd;
      if (!start && end) {
        const act = actualRaw.find(a =>
          a.playerId === est.playerId &&
          a.clubId === est.clubId &&
          a.normalizedContractEnd === end
        );
        if (act) {
          start = act.normalizedContractStart;
        }
      }
      if (start && !end) {
        const act = actualRaw.find(a =>
          a.playerId === est.playerId &&
          a.clubId === est.clubId &&
          a.normalizedContractStart === start
        );
        if (act) {
          end = act.normalizedContractEnd;
        }
      }
      if (!start && !end) return;
      if (players[est.playerId]) {
        const added = players[est.playerId].contracts.find(a =>
          a.playerId === est.playerId &&
          a.clubId === est.clubId &&
          a.start === start &&
          a.end === end
        );
        if (added) {
          return;
        }
      }
      addContract(est.playerId, {
        playerId: est.playerId,
        clubId: est.clubId,
        start,
        end,
        type: "estimated",
        seasonId: est.seasonId,
        raw: est
      });
    };

    actualRaw.forEach(act => {
      addActualContract(act);
    });
    estimatedRaw.forEach(est => {
      addEstimatedContract(est);
    });
    // now we have a list of players and their contracts
    // sort contracts by start date
    Object.keys(players).forEach(playerId => {
      players[playerId].contracts.sort((a, b) => {
        if (a.start && b.start) {
          return new Date(a.start) - new Date(b.start);
        }
        if (a.start) {
          return -1;
        }
        if (b.start) {
          return 1;
        }
        return 0;
      });
    });
    console.log('contract array', players);
  });
};
