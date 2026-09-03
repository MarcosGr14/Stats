(function defineAnalyticsView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const analytics = namespace.analytics;

    if (!constants || !analytics) {
        throw new Error("Stats V2 constants and Analytics must load before the Analytics view.");
    }

    const RANGE_WEEKS = Object.freeze({ all: null, "4": 4, "8": 8, "12": 12 });
    const ACTIVITY_METRICS = Object.freeze({
        votes: { field: "totalVotes", label: "Votos" },
        participants: { field: "participantsEvaluated", label: "Participantes" },
        standouts: { field: "standoutsUsed", label: "Destacados" },
        reasons: { field: "reasonTagMentions", label: "Motivos" }
    });

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = String(text);
        return node;
    }

    function categoryLabel(categoryId) {
        return constants.CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
    }

    function genderLabel(gender) {
        return gender === "female" ? "Mujeres" : "Hombres";
    }

    function ratingLabel(ratingId) {
        return constants.RATING_OPTIONS.find((rating) => rating.id === ratingId)?.label || ratingId;
    }

    function decimal(value, digits = 1) {
        return Number(value).toLocaleString("es-PA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }

    function createQuery(filters = {}) {
        const range = Object.prototype.hasOwnProperty.call(RANGE_WEEKS, filters.range) ? filters.range : "all";
        return {
            lastNWeeks: RANGE_WEEKS[range] || undefined,
            categoryId: filters.categoryId && filters.categoryId !== "all" ? filters.categoryId : undefined,
            gender: filters.gender && filters.gender !== "all" ? filters.gender : undefined,
            groupId: filters.groupId && filters.groupId !== "all" ? filters.groupId : undefined,
            includeOpen: filters.includeOpen === true
        };
    }

    function createDashboardModel(state, filters = {}) {
        const query = createQuery(filters);
        return {
            query,
            scope: analytics.createScope(state, query),
            participantMetrics: analytics.deriveParticipantCategoryMetrics(state, query),
            wins: analytics.mostWeeklyWins(state, query),
            topThree: analytics.mostTopThreeAppearances(state, query),
            standouts: analytics.mostStandouts(state, query),
            duoStandouts: analytics.mostDuoStandouts(state, query),
            soloPicks: analytics.mostSoloPicks(state, query),
            splitDecisions: analytics.mostSplitDecisions(state, query),
            disagreement: analytics.mostControversial(state, query),
            biggestDisagreement: analytics.biggestDisagreement(state, query),
            agreement: analytics.highestAgreement(state, query),
            consistency: analytics.mostConsistent(state, query),
            improvement: analytics.mostImproved(state, query),
            praisedSkills: analytics.deriveMostPraisedSkills(state, query),
            profileTags: analytics.deriveProfileTagAnalytics(state, query),
            ratingDistribution: analytics.deriveRatingDistribution(state, query),
            activity: analytics.deriveWeeklyActivity(state, query),
            mostActiveWeek: analytics.mostActiveWeek(state, query),
            categoryAnalytics: analytics.deriveCategoryAnalytics(state, query)
        };
    }

    function createController(options) {
        const getState = options.getState;
        const viewParticipant = options.viewParticipant;
        let activeSection = "summary";
        let activityMetric = "votes";
        let measuredMilliseconds = 0;
        const byId = (id) => document.getElementById(id);
        const elements = {
            view: byId("analytics"),
            range: byId("analytics-range"),
            category: byId("analytics-category"),
            gender: byId("analytics-gender"),
            group: byId("analytics-group"),
            includeOpen: byId("analytics-include-open"),
            liveStatus: byId("analytics-live-status"),
            scope: byId("analytics-scope"),
            tabs: [...document.querySelectorAll("[data-analytics-tab]")],
            panels: [...document.querySelectorAll("[data-analytics-panel]")],
            summaryGrid: byId("analytics-summary-grid"),
            performanceSort: byId("analytics-performance-sort"),
            performanceBody: byId("analytics-performance-body"),
            performanceEmpty: byId("analytics-performance-empty"),
            p1p2Cards: byId("analytics-p1p2-cards"),
            eventLists: byId("analytics-event-lists"),
            ratingDistribution: byId("analytics-rating-distribution"),
            praisedSkills: byId("analytics-praised-skills"),
            profileTags: byId("analytics-profile-tags"),
            activityMetric: byId("analytics-activity-metric"),
            activityChart: byId("analytics-activity-chart"),
            activityText: byId("analytics-activity-text"),
            activeWeek: byId("analytics-active-week"),
            categoryStats: byId("analytics-category-stats"),
            renderTime: byId("analytics-render-time")
        };

        function filters() {
            return {
                range: elements.range.value,
                categoryId: elements.category.value,
                gender: elements.gender.value,
                groupId: elements.group.value,
                includeOpen: elements.includeOpen.checked
            };
        }

        function renderGroupOptions(state) {
            const selected = elements.group.value || "all";
            const fragment = document.createDocumentFragment();
            const all = element("option", "", "Todos los grupos"); all.value = "all";
            const soloists = element("option", "", "Solistas"); soloists.value = "soloist";
            fragment.append(all, soloists);
            [...state.groups].sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
                .forEach((group) => {
                    const option = element("option", "", group.name);
                    option.value = group.id;
                    fragment.append(option);
                });
            elements.group.replaceChildren(fragment);
            elements.group.value = [...elements.group.options].some((option) => option.value === selected) ? selected : "all";
        }

        function specificGroup(result, query) {
            if (!query.categoryId || !query.gender) return null;
            return result.groups.find((group) => group.categoryId === query.categoryId && group.gender === query.gender) || null;
        }

        function participantButton(participant) {
            const button = element("button", "analytics-participant-link", participant.name);
            button.type = "button";
            button.dataset.analyticsParticipantId = participant.id;
            return button;
        }

        function renderInsufficient(container, minimum = 0, selectionRequired = false) {
            container.append(
                element("strong", "analytics-empty-title", selectionRequired ? "Elige categoría y género" : "Datos insuficientes"),
                element("p", "analytics-empty-copy", selectionRequired
                    ? "Selecciona ambos filtros para comparar sin mezclar resultados."
                    : minimum > 1 ? `Se necesitan al menos ${minimum} semanas evaluadas.` : "Aún no hay resultados con estos filtros.")
            );
        }

        function leaderCard(title, result, query, valueLabel, description, requireSpecific = true) {
            const card = element("article", "analytics-metric-card");
            card.append(element("p", "micro-label", title));
            const group = requireSpecific ? specificGroup(result, query) : null;
            const entries = requireSpecific ? group?.entries || [] : result.entries || [];
            if ((requireSpecific && (!query.categoryId || !query.gender))) {
                renderInsufficient(card, result.minimumSample, true);
                return card;
            }
            if (result.insufficientData || entries.length === 0) {
                renderInsufficient(card, result.minimumSample);
                return card;
            }
            const leaders = entries.filter((entry) => entry.rank === 1);
            const names = element("div", "analytics-leader-names");
            leaders.forEach((entry) => names.append(participantButton(entry.participant)));
            const value = valueLabel(leaders[0]);
            card.append(names, element("strong", "analytics-metric-value", value));
            if (requireSpecific) card.append(element("span", "analytics-context", `${categoryLabel(group.categoryId)} · ${genderLabel(group.gender)}`));
            if (leaders[0].sampleSize) card.append(element("span", "analytics-sample", `${leaders[0].sampleSize} semana${leaders[0].sampleSize === 1 ? "" : "s"}`));
            card.append(element("p", "analytics-metric-help", description));
            return card;
        }

        function skillCard(result) {
            const card = element("article", "analytics-metric-card analytics-metric-card--skill");
            card.append(element("p", "micro-label", "Habilidad más destacada"));
            if (result.insufficientData) {
                renderInsufficient(card);
                return card;
            }
            const leaders = result.entries.filter((entry) => entry.rank === 1);
            card.append(
                element("strong", "analytics-skill-name", leaders.map((entry) => entry.tag.name).join(" · ")),
                element("strong", "analytics-metric-value", `${leaders[0].count} ${leaders[0].count === 1 ? "mención" : "menciones"}`),
                element("p", "analytics-metric-help", "Solo usa motivos guardados en votos semanales.")
            );
            return card;
        }

        function renderSummary(model) {
            const grid = document.createDocumentFragment();
            grid.append(
                leaderCard("Más victorias", model.wins, model.query, (entry) => `${entry.value} victoria${entry.value === 1 ? "" : "s"}`, "Primeros lugares, incluidos los empates."),
                leaderCard("Más Top 3", model.topThree, model.query, (entry) => `${entry.value} ${entry.value === 1 ? "aparición" : "apariciones"}`, "Resultados con puestos 1, 2 o 3."),
                leaderCard("Más destacados", model.standouts, model.query, (entry) => `${entry.value} voto${entry.value === 1 ? "" : "s"}`, "Votos individuales con valoración Destacado."),
                leaderCard("Mayor mejora", model.improvement, model.query, (entry) => `+${decimal(entry.value)} pts/semana`, "Mejora sostenida durante el periodo."),
                leaderCard("Más consistente", model.consistency, model.query, (entry) => `${decimal(entry.metadata.averageWeeklyPoints)} pts promedio`, `Variación baja en al menos ${model.consistency.minimumSample} semanas.`),
                skillCard(model.praisedSkills)
            );
            elements.summaryGrid.replaceChildren(grid);
        }

        function performanceRows(model) {
            const field = elements.performanceSort.value;
            const rows = [...model.participantMetrics.rows];
            const descending = field !== "consistency";
            const value = (row) => ({ wins: row.wins, topThree: row.topThreeAppearances, average: row.averageWeeklyPoints,
                standouts: row.standoutVotes, consistency: row.standardDeviation })[field];
            return rows.sort((left, right) => {
                const a = value(left); const b = value(right);
                if (a === null) return 1;
                if (b === null) return -1;
                return (descending ? b - a : a - b)
                    || left.participant.name.localeCompare(right.participant.name, "es", { sensitivity: "base" });
            });
        }

        function tableCell(label, text) {
            const cell = element("td", "", text);
            cell.dataset.label = label;
            return cell;
        }

        function renderPerformance(model) {
            const fragment = document.createDocumentFragment();
            performanceRows(model).forEach((row) => {
                const tr = element("tr");
                const identity = element("td", "analytics-table-identity");
                identity.dataset.label = "Participante";
                identity.append(participantButton(row.participant), element("small", "", `${categoryLabel(row.categoryId)} · ${genderLabel(row.gender)}`));
                tr.append(
                    identity,
                    tableCell("Victorias", row.wins),
                    tableCell("Top 3", row.topThreeAppearances),
                    tableCell("Destacados", row.standoutVotes),
                    tableCell("Promedio", `${decimal(row.averageWeeklyPoints)} pts`),
                    tableCell("Variación", `${decimal(row.standardDeviation, 2)} pts`),
                    tableCell("Semanas", row.evaluatedWeeks)
                );
                fragment.append(tr);
            });
            elements.performanceBody.replaceChildren(fragment);
            elements.performanceEmpty.hidden = model.participantMetrics.rows.length > 0;
        }

        function comparisonCard(title, result, model, formatter, explanation) {
            const card = element("article", "analytics-comparison-card");
            card.append(element("p", "micro-label", title));
            const group = specificGroup(result, model.query);
            if (!model.query.categoryId || !model.query.gender) {
                renderInsufficient(card, result.minimumSample, true);
                return card;
            }
            const entries = group?.entries || [];
            if (result.insufficientData || entries.length === 0) {
                renderInsufficient(card, result.minimumSample);
                return card;
            }
            const leaders = entries.filter((entry) => entry.rank === 1);
            const names = element("div", "analytics-leader-names");
            leaders.forEach((entry) => names.append(participantButton(entry.participant)));
            card.append(names, element("strong", "analytics-comparison-value", formatter(leaders[0])), element("p", "analytics-metric-help", explanation));
            return card;
        }

        function biggestDisagreementCard(model) {
            const card = element("article", "analytics-comparison-card analytics-comparison-card--feature");
            card.append(element("p", "micro-label", "Mayor desacuerdo puntual"));
            const group = specificGroup(model.biggestDisagreement, model.query);
            if (!model.query.categoryId || !model.query.gender) {
                renderInsufficient(card, 1, true);
                return card;
            }
            const entry = group?.entries?.[0];
            if (!entry) {
                renderInsufficient(card);
                return card;
            }
            card.append(participantButton(entry.participant), element("strong", "analytics-comparison-value", `Diferencia: ${entry.value}`));
            const votes = element("div", "analytics-dual-votes");
            constants.VOTER_IDS.forEach((userId) => {
                const vote = entry.votes.find((item) => item.userId === userId);
                votes.append(element("span", "", `${userId.toUpperCase()}: ${vote ? ratingLabel(vote.rating) : "Sin evaluar"}`));
            });
            card.append(votes, element("p", "analytics-metric-help", entry.week.label));
            return card;
        }

        function eventList(title, result, model, noun) {
            const section = element("article", "analytics-event-list");
            section.append(element("h3", "", title));
            const group = specificGroup(result, model.query);
            if (!model.query.categoryId || !model.query.gender) {
                renderInsufficient(section, 1, true);
                return section;
            }
            const entries = group?.entries?.slice(0, 5) || [];
            if (entries.length === 0) {
                renderInsufficient(section);
                return section;
            }
            const list = element("ol", "analytics-ranked-list");
            entries.forEach((entry) => {
                const item = element("li");
                item.append(participantButton(entry.participant), element("strong", "", `${entry.value} ${noun}${entry.value === 1 ? "" : "s"}`));
                list.append(item);
            });
            section.append(list);
            return section;
        }

        function renderRatingDistribution(model) {
            const fragment = document.createDocumentFragment();
            model.ratingDistribution.distributions.forEach((distribution) => {
                const card = element("article", "analytics-rating-card");
                card.append(element("h3", "", distribution.userId.toUpperCase()), element("p", "analytics-sample", `${distribution.totalVotes} votos`));
                distribution.ratings.forEach((rating) => {
                    const row = element("div", "analytics-rating-row");
                    const label = element("span", "", rating.label);
                    const track = element("span", `analytics-rating-track analytics-rating-track--${rating.ratingId}`);
                    const bar = element("span", "analytics-rating-bar");
                    bar.style.width = `${rating.percentage}%`;
                    track.append(bar);
                    row.append(label, track, element("strong", "", `${Math.round(rating.percentage)}% · ${rating.count}`));
                    card.append(row);
                });
                fragment.append(card);
            });
            elements.ratingDistribution.replaceChildren(fragment);
        }

        function renderP1P2(model) {
            elements.p1p2Cards.replaceChildren(
                biggestDisagreementCard(model),
                comparisonCard("Mayor desacuerdo promedio", model.disagreement, model, (entry) => `${decimal(entry.value)} puntos`, "Valoraciones más diferentes entre ambos."),
                comparisonCard("Mayor acuerdo", model.agreement, model, (entry) => `${entry.sampleSize} semanas`, "Valoraciones muy similares entre ambos.")
            );
            elements.eventLists.replaceChildren(
                eventList("Destacados por ambos", model.duoStandouts, model, "evento"),
                eventList("Elecciones individuales", model.soloPicks, model, "evento"),
                eventList("Opiniones divididas", model.splitDecisions, model, "evento")
            );
            renderRatingDistribution(model);
        }

        function rankedTagList(entries, emptyCopy) {
            const list = element("ol", "analytics-tag-ranking");
            if (entries.length === 0) {
                list.append(element("li", "analytics-list-empty", emptyCopy));
                return list;
            }
            entries.slice(0, 10).forEach((entry) => {
                const item = element("li");
                item.append(element("span", "", entry.tag.name), element("strong", "", entry.count));
                list.append(item);
            });
            return list;
        }

        function renderSkills(model) {
            elements.praisedSkills.replaceChildren(rankedTagList(model.praisedSkills.entries, "Aún no hay motivos semanales con estos filtros."));
            const fragment = document.createDocumentFragment();
            [
                ["strength", "Fortalezas más comunes"],
                ["weakness", "Por mejorar más comunes"],
                ["neutral", "Especiales más comunes"]
            ].forEach(([type, title]) => {
                const card = element("article", `analytics-tag-card analytics-tag-card--${type}`);
                card.append(element("h3", "", title), rankedTagList(model.profileTags.byType[type], "Sin tags del perfil."));
                fragment.append(card);
            });
            elements.profileTags.replaceChildren(fragment);
        }

        function renderActivityChart(model) {
            const definition = ACTIVITY_METRICS[activityMetric];
            const values = model.activity.weeks.map((week) => week[definition.field]);
            const maximum = Math.max(1, ...values);
            const fragment = document.createDocumentFragment();
            model.activity.weeks.forEach((week) => {
                const value = week[definition.field];
                const row = element("div", "analytics-activity-row");
                row.append(element("strong", "analytics-activity-week", week.week.label));
                const track = element("span", "analytics-activity-track");
                const bar = element("span", "analytics-activity-bar");
                bar.style.width = `${(value / maximum) * 100}%`;
                track.append(bar);
                row.append(track, element("strong", "analytics-activity-value", value));
                fragment.append(row);
            });
            elements.activityChart.replaceChildren(fragment);
            const summary = model.activity.weeks.length
                ? `${definition.label} por semana: ${model.activity.weeks.map((week) => `${week.week.label} ${week[definition.field]}`).join(", ")}.`
                : "Aún no hay semanas dentro de este rango.";
            elements.activityChart.setAttribute("aria-label", summary);
            elements.activityText.textContent = summary;
        }

        function renderActiveWeek(model) {
            elements.activeWeek.replaceChildren();
            elements.activeWeek.append(element("p", "micro-label", "Semana más activa"));
            if (model.mostActiveWeek.insufficientData) {
                renderInsufficient(elements.activeWeek);
                return;
            }
            const weeks = model.mostActiveWeek.entries.map((entry) => entry.week.label).join(" · ");
            const count = model.mostActiveWeek.entries[0].totalVotes;
            elements.activeWeek.append(
                element("strong", "analytics-active-week-name", weeks),
                element("strong", "analytics-metric-value", `${count} voto${count === 1 ? "" : "s"}`),
                element("p", "analytics-metric-help", model.mostActiveWeek.entries.length > 1 ? "Empate en actividad." : "Actividad, no rendimiento.")
            );
        }

        function renderCategoryStats(model) {
            const fragment = document.createDocumentFragment();
            model.categoryAnalytics.rows.forEach((row) => {
                const card = element("article", "analytics-category-card");
                card.dataset.category = row.categoryId;
                card.append(element("h3", "", `${categoryLabel(row.categoryId)} · ${genderLabel(row.gender)}`));
                if (row.insufficientData) {
                    renderInsufficient(card);
                } else {
                    const stats = element("div", "analytics-category-metrics");
                    stats.append(
                        element("span", "", `${row.totalVotes} votos`),
                        element("span", "", `${row.uniqueParticipantsEvaluated} participantes`),
                        element("span", "", `${decimal(row.averageWeeklyScore)} pts promedio`),
                        element("span", "", `${row.totalStandouts} destacados`)
                    );
                    card.append(stats);
                    if (row.mostPraisedSkill) card.append(element("p", "analytics-card-note", `Habilidad: ${row.mostPraisedSkill.tag.name}`));
                    if (row.mostWinsParticipants.length) {
                        const winners = element("div", "analytics-card-winners");
                        winners.append(element("span", "", "Más victorias:"));
                        row.mostWinsParticipants.forEach((entry) => winners.append(participantButton(entry.participant)));
                        card.append(winners);
                    }
                }
                fragment.append(card);
            });
            elements.categoryStats.replaceChildren(fragment);
        }

        function renderScope(model) {
            const category = model.query.categoryId ? categoryLabel(model.query.categoryId) : "Todas las categorías";
            const gender = model.query.gender ? genderLabel(model.query.gender) : "Todos los géneros";
            const weeks = model.scope.weekIds.length;
            elements.scope.textContent = `${category} · ${gender} · ${weeks} semana${weeks === 1 ? "" : "s"}`;
            elements.liveStatus.hidden = !model.query.includeOpen;
            elements.renderTime.textContent = `Actualizado en ${decimal(measuredMilliseconds, 0)} ms · sin caché`;
        }

        function render() {
            const state = getState();
            renderGroupOptions(state);
            const startedAt = performance.now();
            const model = createDashboardModel(state, filters());
            measuredMilliseconds = performance.now() - startedAt;
            renderScope(model);
            renderSummary(model);
            renderPerformance(model);
            renderP1P2(model);
            renderSkills(model);
            renderActivityChart(model);
            renderActiveWeek(model);
            renderCategoryStats(model);
        }

        function selectSection(sectionId, focus = false) {
            if (!elements.tabs.some((tab) => tab.dataset.analyticsTab === sectionId)) return;
            activeSection = sectionId;
            elements.tabs.forEach((tab) => {
                const selected = tab.dataset.analyticsTab === sectionId;
                tab.setAttribute("aria-selected", String(selected));
                tab.tabIndex = selected ? 0 : -1;
            });
            elements.panels.forEach((panel) => { panel.hidden = panel.dataset.analyticsPanel !== sectionId; });
            if (focus) elements.tabs.find((tab) => tab.dataset.analyticsTab === sectionId)?.focus();
        }

        [elements.range, elements.category, elements.gender, elements.group, elements.includeOpen]
            .forEach((control) => control.addEventListener("change", render));
        elements.performanceSort.addEventListener("change", render);
        elements.activityMetric.addEventListener("change", () => {
            activityMetric = elements.activityMetric.value;
            renderActivityChart({ activity: analytics.deriveWeeklyActivity(getState(), createQuery(filters())) });
        });
        elements.tabs.forEach((tab, index) => {
            tab.addEventListener("click", () => selectSection(tab.dataset.analyticsTab));
            tab.addEventListener("keydown", (event) => {
                let target = null;
                if (event.key === "ArrowRight") target = (index + 1) % elements.tabs.length;
                if (event.key === "ArrowLeft") target = (index - 1 + elements.tabs.length) % elements.tabs.length;
                if (event.key === "Home") target = 0;
                if (event.key === "End") target = elements.tabs.length - 1;
                if (target === null) return;
                event.preventDefault();
                selectSection(elements.tabs[target].dataset.analyticsTab, true);
            });
        });
        elements.view.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-analytics-participant-id]");
            if (button) viewParticipant(button.dataset.analyticsParticipantId);
        });

        return Object.freeze({
            activate() {
                selectSection(activeSection);
                render();
            }
        });
    }

    namespace.analyticsView = Object.freeze({ createQuery, createDashboardModel, createController });
    root.StatsV2 = namespace;
})(globalThis);
