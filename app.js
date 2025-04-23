window.onload = function () {
  Promise.all([
    fetch("norm-estimated.json").then((res) => res.json()),
    fetch("norm-actual.json").then((res) => res.json()),
  ]).then(([estimatedRaw, actualRaw]) => {
    const parseDate = (str) => str ? new Date(str) : null;

    // Add contract length (in months) to each entry
    const estimated = estimatedRaw.map(est => {
      const start = parseDate(est.contractStart || est.normalizedContractStart);
      const end = parseDate(est.contractEnd || est.normalizedContractEnd);

      let length = null;
      if (start && end) {
        const years = end.getFullYear() - start.getFullYear();
        const months = end.getMonth() - start.getMonth();
        length = years * 12 + months;
      }

      return { ...est, contractLength: length };
    });

    const actual = actualRaw.map(act => {
      const start = parseDate(act.actualContractStart || act.normalizedContractStart);
      const end = parseDate(act.actualContractEnd || act.normalizedContractEnd);

      let length = null;
      if (start && end) {
        const years = end.getFullYear() - start.getFullYear();
        const months = end.getMonth() - start.getMonth();
        length = years * 12 + months;
      }

      return { ...act, contractLength: length };
    });

    const matched = [];
    const estimatedOnly = [...estimated];
    const actualOnly = [];

    actual.forEach(act => {
      const idx = estimatedOnly.findIndex(est =>
        est.playerId === act.playerId && est.normalizedContractStart === act.normalizedContractStart  && est.clubId === act.clubId
      );

      if (idx !== -1) {
        const est = estimatedOnly[idx];
        matched.push({
          x: est.contractLength ?? 0,
          y: act.contractLength ?? 0,
          est: { ...est, type: "matched" },
          act: { ...act, type: "matched" }
        });
        estimatedOnly.splice(idx, 1);
      } else {
        actualOnly.push({
          x: 0,
          y: act.contractLength ?? 0,
          act: { ...act, type: "actual" }
        });
      }
    });

    const estimatedOnlyFormatted = estimatedOnly.map(est => ({
      x: est.contractLength ?? 0,
      y: 0,
      est: { ...est, type: "estimated" }
    }));

    const ctx = document.getElementById("contractChart").getContext("2d");

    new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Matched Contracts",
            data: matched,
            backgroundColor: "rgba(75, 192, 192, 0.9)",
            pointRadius: 6
          },
          {
            label: "Estimated Only",
            data: estimatedOnlyFormatted,
            backgroundColor: "rgba(255, 234, 98, 0.97)",
            pointRadius: 5
          },
          {
            label: "Actual Only",
            data: actualOnly,
            backgroundColor: "rgba(255, 99, 132, 0.3)",
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

                const formatLength = (val) =>
                  val != null ? Number(val).toFixed(1) + " mo" : "N/A";

                if (d.est && d.act) {
                  return [
                    `🟢 Matched`,
                    `Player: ${d.est.playerId}`,
                    `Est Club: ${d.est.clubId}`,
                    `Act Club: ${d.act.clubId}`,
                    `Est Length: ${formatLength(d.est.contractLength)}`,
                    `Act Length: ${formatLength(d.act.contractLength)}`
                  ];
                } else if (d.est) {
                  return [
                    `🔵 Estimated Only`,
                    `Player: ${d.est.playerId}`,
                    `Club: ${d.est.clubId}`,
                    `Length: ${formatLength(d.est.contractLength)}`
                  ];
                } else if (d.act) {
                  return [
                    `🔴 Actual Only`,
                    `Player: ${d.act.playerId}`,
                    `Club: ${d.act.clubId}`,
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
