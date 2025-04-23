window.onload = function () {
  Promise.all([
    fetch("firstDraft/estimatedContracts.json").then((res) => res.json()),
    fetch("firstDraft/actualContracts.json").then((res) => res.json()),
  ]).then(([estimatedRaw, actualRaw]) => {
    const DateTime = luxon.DateTime;

    const normalizeDate = (dateStr) => {
      const date = DateTime.fromISO(dateStr);
      if (!date.isValid) return null;
      const june30 = DateTime.fromObject({ year: date.year, month: 6, day: 30 });
      const dec31 = DateTime.fromObject({ year: date.year, month: 12, day: 31 });
      const diffToJune = Math.abs(date.diff(june30, 'days').days);
      const diffToDec = Math.abs(date.diff(dec31, 'days').days);
      return diffToJune < diffToDec ? june30 : dec31;
    };

    const monthDiff = (start, end) => end.diff(start, 'months').months;

    // Normalize and structure contracts
    const normalizeContracts = (contracts, type) =>
      contracts.map(c => {
        let startRaw = type === 'estimated' ? c.contractStart : c.contractSigned;
        let endRaw = type === 'estimated' ? c.actualContractEnd : c.contractExpiration;
        if (!endRaw && type === 'estimated') {
          endRaw = c.contractEnd;
        }
        const start = normalizeDate(startRaw);
        const end = normalizeDate(endRaw);
        if (!start && !end) return null;
        return {
          playerId: c.playerId,
          clubId: c.clubId,
          type,
          start,
          end,
          contractLength: start && end ? monthDiff(start, end) : 0,
          seasonId: c.seasonId,
          raw: c // keep raw for tooltip info
        };
      }).filter(c => c);

    const estimated = normalizeContracts(estimatedRaw, 'estimated');
    // filter actual so we only keep the ones where  isLoan is false
    // const actualRawFiltered = actualRaw.filter(c => !c.isLoan);
    const actual = normalizeContracts(actualRaw, 'actual');

    const matched = [];
    const estimatedOnly = [];
    const actualOnly = [...actual];

    estimated.forEach(est => {
      const idx = actualOnly.findIndex(act =>
        act.playerId === est.playerId &&
        act.clubId === est.clubId &&
        (act.start?.equals(est.start) || act.seasonId === est.seasonId)
      );

      if (idx !== -1) {
        const act = actualOnly[idx];
        matched.push({ x: est.contractLength, y: act.contractLength, est, act });
        actualOnly.splice(idx, 1);
      } else {
        // estimatedOnly.push({ x: est.contractLength, y: 0, est });
      }
    });

    const unmatchedActual = actualOnly.map(act => ({
      x: 0,
      y: act.contractLength,
      act
    }));

    const ctx = document.getElementById("contractChart").getContext("2d");

    new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Matched Contracts",
            data: matched,
            backgroundColor: "rgba(75, 192, 192, 0.9)", // teal
            pointRadius: 6
          },
          {
            label: "Estimated Only",
            data: estimatedOnly,
            backgroundColor: "rgba(75, 192, 192, 0.3)", // light teal
            pointRadius: 5
          },
          {
            label: "Actual Only",
            data: unmatchedActual,
            backgroundColor: "rgba(255, 99, 132, 0.3)", // light red
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const d = ctx.raw;
          
                const formatDate = (dt) => dt?.toFormat?.("yyyy-MM-dd") ?? "N/A";
                const formatLength = (val) => val?.toFixed?.(1) + " mo" ?? "N/A";
          
                if (d.est && d.act) {
                  return [
                    `🟢 Matched`,
                    `Player: ${d.est.playerId}`,
                    `Club: ${d.est.clubId}`,
                    `Estimated:`,
                    `- Start: ${formatDate(d.est.start)}`,
                    `- End: ${formatDate(d.est.end)}`,
                    `- Length: ${formatLength(d.est.contractLength)}`,
                    `Actual:`,
                    `- Start: ${formatDate(d.act.start)}`,
                    `- End: ${formatDate(d.act.end)}`,
                    `- Length: ${formatLength(d.act.contractLength)}`
                  ];
                } else if (d.est) {
                  return [
                    `🔵 Estimated Only`,
                    `Player: ${d.est.playerId}`,
                    `Club: ${d.est.clubId}`,
                    `Start: ${formatDate(d.est.start)}`,
                    `End: ${formatDate(d.est.end)}`,
                    `Length: ${formatLength(d.est.contractLength)}`
                  ];
                } else if (d.act) {
                  return [
                    `🔴 Actual Only`,
                    `Player: ${d.act.playerId}`,
                    `Club: ${d.act.clubId}`,
                    `Start: ${formatDate(d.act.start)}`,
                    `End: ${formatDate(d.act.end)}`,
                    `Length: ${formatLength(d.act.contractLength)}`
                  ];
                }
          
                return '';
              }
            }
          },          
          legend: {
            position: 'top'
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Estimated Contract Length (months)'
            },
            min: 0,
            suggestedMax: 60
          },
          y: {
            title: {
              display: true,
              text: 'Actual Contract Length (months)'
            },
            min: 0,
            suggestedMax: 60
          }
        }
      }
    });
  });
};
