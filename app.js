window.onload = function () {
  Promise.all([
    fetch("estimatedContracts.json").then((res) => res.json()),
    fetch("actualContracts.json").then((res) => res.json()),
  ]).then(([estimated, actual]) => {
    const parseDate = (dateStr) => {
      const d = luxon.DateTime.fromISO(dateStr);
      return d.isValid ? d.toJSDate() : null;
    };

    const datasets = [];

    // Process Estimated Contracts
    estimated.forEach((est, index) => {
      if (est.contractStart && est.contractEnd) {
        const start = parseDate(est.contractStart);
        const end = parseDate(est.contractEnd);

        if (start && end) {
          datasets.push({
            label: `Estimated - Player ${est.playerId}, Club ${est.clubId}`,
            data: [
              { x: end, y: start }
            ],
            backgroundColor: "rgba(54, 162, 235, 0.8)", // Blue
            borderColor: "rgba(54, 162, 235, 1)",
            pointRadius: 6,
            pointStyle: "circle",
          });
        }
      }
    });

    // Process Actual Contracts
    actual.forEach((act, index) => {
      if (act.isLoan === true) {
        return; // Skip loan contracts
      }
      let start;
      let end;
      if (act.contractSigned && act.contractExpiration) {
        start = parseDate(act.contractSigned);
        end = parseDate(act.contractExpiration);
      } else if (act.playerJoined && act.contractEnd) {
        start = parseDate(act.playerJoined);
        end = parseDate(act.contractEnd);
      }

        if (start && end) {
          datasets.push({
            label: `Actual - Player ${act.playerId}, Club ${act.clubId}`,
            data: [
              { x: end, y: start }
            ],
            backgroundColor: "rgba(255, 99, 132, 0.8)", // Red
            borderColor: "rgba(255, 99, 132, 1)",
            pointRadius: 6,
            pointStyle: "circle",
          });
        }
    });

    // Create the scatter plot
    const ctx = document.getElementById("contractChart").getContext("2d");

    new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const start = luxon.DateTime.fromJSDate(ctx.raw.y).toISODate();
                const end = luxon.DateTime.fromJSDate(ctx.raw.x).toISODate();
                return `${ctx.dataset.label}: Start: ${start}, End: ${end}`;
              }
            }
          },
          legend: {
            display: false,
            position: "top"
          }
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "year",
              tooltipFormat: "ll",
            },
            min: new Date('2015-01-01').toISOString(),
            max: new Date('2026-12-31').toISOString(),
            title: {
              display: true,
              text: 'Contract End Date'
            }
          },
          y: {
            type: "time",
            time: {
              unit: "year",
              tooltipFormat: "ll",
            },
            min: new Date('2015-01-01').toISOString(),
            max: new Date('2026-12-31').toISOString(),
            title: {
              display: true,
              text: 'Contract Start Date'
            }
          }
        }
      }
    });
  });
};
