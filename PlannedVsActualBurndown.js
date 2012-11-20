function PlannedVsActualBurndown() {
    this.display = function() {
        dojo.require("dojox.charting.Chart2D");
        var iterations = {};
        var waiter, releaseDropdown, aggregatedTable, chart;

        var showLegend = function() {
            dojo.byId("legendDiv").innerHTML =
                    "<div class='blue box'></div> Actual Burndown&nbsp;&nbsp;&nbsp;<div class='green box'></div> Planned Burndown";
        };

        var buildLineChart = function() {
            var labels = [];
            var plannedBurndown = [];
            var actualBurndownPast = [];
            var actualBurndownFuture = [];
            var zeros = [];

            var i = 1;
            var futureCount = 0;
            rally.forEach(iterations, function(value) {
                labels.push({value: i, text: value.Name});
                plannedBurndown.push(value.PlannedBurndown);
                if (value.IsFuture && futureCount === 0) {  // past/future plot point
                    futureCount = 1;
                    actualBurndownPast.push(value.ActualBurndown);
                    actualBurndownFuture.push(value.ActualBurndown);
                } else if (value.IsFuture && futureCount > 0) {  // future plot points
                    actualBurndownPast.push(null);
                    actualBurndownFuture.push(value.ActualBurndown);
                } else { // past plot points
                    actualBurndownPast.push(value.ActualBurndown);
                    actualBurndownFuture.push(null);
                }
                zeros.push(0);
                i++;
            });

            chart = new dojox.charting.Chart2D("lineChartDiv");
            chart.addPlot("default", {type: "Lines"});
            chart.addAxis("x", {labels: labels});
            chart.addAxis("y", {vertical: true});
            chart.addSeries("Planned Burndown", plannedBurndown, {stroke: {color:"#666666", style: "LongDash"}});
            chart.addSeries("Actual Burndown Past", actualBurndownPast, {stroke: {color:"#5C9ACB"}});
            chart.addSeries("Actual Burndown Future", actualBurndownFuture, {stroke: {color:"#5C9ACB", style: "LongDash"}});
            chart.addSeries("Zero Axis", zeros, {stroke: {color:"black", width:1}});
            chart.render();

            showLegend();
        };

        var populateTable = function(table) {
            function formatDate(date) {
                if (date === "") {
                    return "";
                }
                return dojo.date.locale.format(dojo.date.stamp.fromISOString(date.replace(/Z/, "")), {datePattern: "yyyy-MM-dd", selector: "date"});
            }

            var i = 0;
            rally.forEach(iterations, function(value) {
                var colorClass = value.IsFuture ? "greyText" : "blueText";

                table.setCell(i, 0, value.Name);
                table.setCell(i, 1, formatDate(value.StartDate));
                table.setCell(i, 2, formatDate(value.EndDate));
                table.setCell(i, 3, '' + value.PlanEstimate);
                table.setCell(i, 4, '' + value.ActualVelocity);
                table.setCell(i, 5, '' + value.Resources);
                table.setCell(i, 6, "<span class='" + colorClass + "'>" + value.ActualBurndown + "</span>");
                table.setCell(i, 7, "<span class='greenText'>" + value.PlannedBurndown + "</span>");
                i++;
            });
        };

        var showTable = function(releasePlanEstimate) {
            var aggregatedTableConfig = {
                'sortingEnabled': false,
                'columnKeys'    : ['Iteration Name', 'Start Date', 'End Date', 'Plan Estimate', 'Actual Velocity', 'Planned Velocity', 'Actual Burndown', 'Planned Burndown'],
                'width'         : '880px'
            };
            aggregatedTable = new rally.sdk.ui.Table(aggregatedTableConfig);
            populateTable(aggregatedTable);
            waiter.hide();
            dojo.byId('planEstimateDiv').innerHTML = 'Release Plan Estimate: ' + releasePlanEstimate;
            dojo.byId("legendDiv").style.display = "";
            dojo.byId("planEstimateDiv").style.display = "";
            dojo.byId("aggregatedDataDiv").style.display = "";
            aggregatedTable.display("aggregatedDataDiv");

            buildLineChart();
        };

        var aggregateBurndown = function(releasePlanEstimate) {
            function getRallyDate(jsDate) {
                var yr = jsDate.getUTCFullYear();
                var mon = ("0" + (jsDate.getUTCMonth() + 1));
                var day = ("0" + jsDate.getUTCDate()).substr(-2);
                var hr = ("0" + jsDate.getUTCHours()).substr(-2);
                var min = ("0" + jsDate.getUTCMinutes()).substr(-2);
                var sec = ("0" + jsDate.getUTCSeconds()).substr(-2);

                return       yr +
                        "-" + mon.substr(mon.length - 2, 2) +
                        "-" + day.substr(day.length - 2, 2) +
                        "T" + hr + ":" + min + ":" + sec;
            }

            var actualBurndown, plannedBurndown, future, lastPlannedVelocity, lastActualVelocity;
            var today = getRallyDate(new Date());
            var i = 1;

            rally.forEach(iterations, function(value) {
                if (i === 1) {                               // first iteration
                    actualBurndown = releasePlanEstimate;
                    plannedBurndown = releasePlanEstimate;
                    future = value.EndDate >= today;
                } else if (value.Name === "Release") {       //release row
                    if (future) {
                        actualBurndown -= lastPlannedVelocity;
                        plannedBurndown -= lastPlannedVelocity;
                    } else {
                        actualBurndown -= lastActualVelocity;
                        plannedBurndown -= lastPlannedVelocity;
                    }
                } else if (value.EndDate >= today) {         // future iteration
                    actualBurndown -= lastPlannedVelocity;
                    plannedBurndown -= lastPlannedVelocity;
                    future = true;
                } else if (value.EndDate < today) {         // past iteration
                    actualBurndown -= lastActualVelocity;
                    plannedBurndown -= lastPlannedVelocity;
                    future = false;
                }
                lastPlannedVelocity = value.Resources;
                lastActualVelocity = value.ActualVelocity;

                iterations[value.Name].ActualBurndown = actualBurndown;
                iterations[value.Name].PlannedBurndown = plannedBurndown;
                iterations[value.Name].IsFuture = future;
                i++;
            });

            showTable(releasePlanEstimate);
        };

        var aggregateData = function(results) {
            var releasePlanEstimate = 0;
            var allStoriesDefectsDefectSuites = results.stories;
            allStoriesDefectsDefectSuites = allStoriesDefectsDefectSuites.concat(results.defects);
            allStoriesDefectsDefectSuites = allStoriesDefectsDefectSuites.concat(results.defectSuites);

            dojo.forEach(allStoriesDefectsDefectSuites, function(item) { //aggregate story, defect, & defect suite data
                var estimate = item.PlanEstimate || 0;

                iterations[item.Iteration.Name].PlanEstimate += estimate;
                releasePlanEstimate += estimate;
                if (item.ScheduleState === 'Accepted') {
                    iterations[item.Iteration.Name].ActualVelocity += estimate;
                }
            });

            aggregateBurndown(releasePlanEstimate);
        };

        var makeIterationObjects = function(results) {
            dojo.forEach(results.iterations, function(iteration) {
                var resources = iteration.Resources || 0;
                if (iterations[iteration.Name]) {
                    resources = resources + iterations[iteration.Name].Resources;
                }

                iterations[iteration.Name] = {
                    _ref:           iteration._ref,
                    Name:           iteration.Name,
                    StartDate:      iteration.StartDate,
                    EndDate:        iteration.EndDate,
                    Resources:      resources,
                    PlanEstimate:   0,
                    ActualVelocity: 0,
                    ActualBurndown: 0,
                    PlannedBurndown:0,
                    IsFuture:       ""};
            });

            iterations.Release = {
                _ref:           "",
                Name:           "Release",
                StartDate:      "",
                EndDate:        "",
                Resources:      "",
                PlanEstimate:   "",
                ActualVelocity: "",
                ActualBurndown: 0,
                PlannedBurndown:0,
                IsFuture:       ""};


            aggregateData(results);
        };

        function clearComponents() {
            dojo.byId("legendDiv").style.display = "none";
            dojo.byId("planEstimateDiv").style.display = "none";
            dojo.byId("aggregatedDataDiv").style.display = "none";

            waiter.display("waiter");
            iterations = {};

            if (chart) {
                chart.destroy();
            }

            if (aggregatedTable) {
                aggregatedTable.destroy();
                aggregatedTable = null;
            }
        }

        function releaseSelected() {
            clearComponents();

            var queryConfig = [];
            var typeArray = ['hierarchicalrequirement','Defect','DefectSuite'];
            var keyArray = ['stories','defects','defectSuites'];

            dojo.forEach(typeArray, function(query, i) {
                queryConfig.push({
                    type : typeArray[i],
                    key  : keyArray[i],
                    query:  rally.sdk.util.Query.and(['Iteration.StartDate >= "' + releaseDropdown.getSelectedStart() + '"',
                        'Iteration.StartDate <= "' + releaseDropdown.getSelectedEnd() + '"']).or(
                            rally.sdk.util.Query.and(['Iteration.EndDate >= "' + releaseDropdown.getSelectedStart() + '"',
                                'Iteration.EndDate <= "' + releaseDropdown.getSelectedEnd() + '"'])),
                    fetch: 'Name,Iteration,ScheduleState,PlanEstimate'
                });
            });

            queryConfig.push({
                type : 'Iterations',
                key  : 'iterations',
                query:  rally.sdk.util.Query.and(['StartDate >= "' + releaseDropdown.getSelectedStart() + '"',
                    'StartDate <= "' + releaseDropdown.getSelectedEnd() + '"']).or(
                        rally.sdk.util.Query.and(['EndDate >= "' + releaseDropdown.getSelectedStart() + '"',
                            'EndDate <= "' + releaseDropdown.getSelectedEnd() + '"'])),
                fetch: 'Name,Resources,StartDate,EndDate',
                order: 'EndDate'
            });

            rallyDataSource.findAll(queryConfig, makeIterationObjects);
        }

        rally.sdk.ui.AppHeader.setHelpTopic("240");
        rally.sdk.ui.AppHeader.showPageTools(true);

        rallyDataSource = new rally.sdk.data.RallyDataSource('__WORKSPACE_OID__',
                '__PROJECT_OID__',
                '__PROJECT_SCOPING_UP__',
                '__PROJECT_SCOPING_DOWN__');

        releaseDropdown = new rally.sdk.ui.ReleaseDropdown({}, rallyDataSource);

        waiter = new rally.sdk.ui.basic.Wait({hideTarget:false});
        waiter.display("waiter");

        dojo.addOnLoad(function() {  //executes when dojo requirements are loaded
            releaseDropdown.display("dropdownDiv", releaseSelected);
        });
    };
}