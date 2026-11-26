(function defineParticipantCatalog(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const data = namespace.data;
    if (!data) throw new Error("Stats V2 data must load before the participant catalog.");

    const CATALOG_VERSION = 2;
    const GROUPS = Object.freeze([
        ["aespa", "female", "Karina|Giselle|Winter|Ningning"],
        ["Alice Syndrome", "female", "Taira|Awon|Sebeen|Jeongmin"],
        ["BLACKPINK", "female", "Jisoo|Jennie|Rosé|Lisa"],
        ["GIRLSET", "female", "Lexi|Camila|Kendall|Savanna"],
        ["Hearts2Hearts", "female", "Jiwoo|Carmen|Yuha|Stella|Juun|A-na|Ian|Ye-on"],
        ["ILLIT", "female", "Yunah|Minju|Moka|Wonhee|Iroha"],
        ["IVE", "female", "Yujin|Gaeul|Rei|Wonyoung|Liz|Leeseo"],
        ["i-dle", "female", "Miyeon|Minnie|Soyeon|Yuqi|Shuhua"],
        ["KiiiKiii", "female", "Jiyu|Leesol|Sui|Haum|Kya"],
        ["LE SSERAFIM", "female", "Sakura|Kim Chaewon|Huh Yunjin|Kazuha|Hong Eunchae"],
        ["NewJeans", "female", "Minji|Hanni|Haerin|Hyein"],
        ["NMIXX", "female", "Lily|Haewon|Sullyoon|Bae|Jiwoo|Kyujin"],
        ["QWER", "female", "Chodan|Magenta|Hina|Siyeon"],
        ["Red Velvet", "female", "Irene|Seulgi|Wendy|Joy|Yeri"],
        ["RESCENE", "female", "Woni|Liv|Minami|May|Zena"],
        ["TUIDE", "female", "Seohee|Seoyeon|Elena|Jia|Saki|Seah|Yi Hani"],
        ["TWICE", "female", "Nayeon|Jeongyeon|Momo|Sana|Jihyo|Mina|Dahyun|Chaeyoung|Tzuyu"],
        ["XG", "female", "Jurin|Chisa|Hinata|Harvey|Juria|Maya|Cocona"],
        ["YOUNG POSSE", "female", "Sunhye|Yeonjung|Jiana|Doeun|Jieun"],
        ["&TEAM", "male", "K|Fuma|Nicholas|EJ|Yuma|Jo|Harua|Taki|Maki"],
        ["ALLDAY PROJECT", "male", "Tarzzan|Woochan"],
        ["ATEEZ", "male", "Hongjoong|Seonghwa|Yunho|Yeosang|San|Mingi|Wooyoung|Jongho"],
        ["CORTIS", "male", "Martin|James|Juhoon|Seonghyeon|Keonho"],
        ["DAY6", "male", "Sungjin|Young K|Wonpil|Dowoon"],
        ["ENHYPEN", "male", "Jungwon|Jay|Jake|Sunghoon|Sunoo|Ni-ki"],
        ["EXO", "male", "Suho|Xiumin|Lay|Baekhyun|Chen|Chanyeol|D.O.|Kai|Sehun"],
        ["GOT7", "male", "Jay B|Mark|Jackson|Jinyoung|Youngjae|BamBam|Yugyeom"],
        ["iKON", "male", "Jay|Song|Bobby|DK|Ju-ne|Chan"],
        ["KickFlip", "male", "Kyehoon|Amaru|Donghwa|Juwang|Minje|Keiju|Donghyeon"],
        ["LNGSHOT", "male", "Ohyul|Ryul|Woojin|Louis"],
        ["MONSTA X", "male", "Shownu|Minhyuk|Kihyun|Hyungwon|Joohoney|I.M."],
        ["NCT 127", "male", "Taeyong|Johnny|Yuta|Doyoung|Jaehyun|Jungwoo|Haechan"],
        ["RIIZE", "male", "Shotaro|Eunseok|Sungchan|Wonbin|Sohee|Anton"],
        ["SEVENTEEN", "male", "S.Coups|Jeonghan|Joshua|Jun|Hoshi|Wonwoo|Woozi|The8|Mingyu|DK|Seungkwan|Vernon|Dino"],
        ["Stray Kids", "male", "Bang Chan|Lee Know|Changbin|Hyunjin|Han|Felix|Seungmin|I.N."],
        ["TOMORROW X TOGETHER (TXT)", "male", "Soobin|Yeonjun|Beomgyu|Taehyun|Huening Kai"],
        ["TREASURE", "male", "Choi Hyun-suk|Jihoon|Yoshi|Junkyu|Yoon Jae-hyuk|Asahi|Doyoung|Haruto|Park Jeong-woo|So Jung-hwan"],
        ["WayV", "male", "Kun|Ten|Winwin|Xiaojun|Hendery|Yangyang"],
        ["Xdinary Heroes", "male", "Jungsu|Gaon|O.de|Jun Han|Jooyeon"]
    ]);
    const SOLOISTS = Object.freeze([
        ["B.I", "male"], ["EVAN", "male"], ["Jeon Somi", "female"], ["Keshi", "male"],
        ["SIK-K", "male"], ["WOODZ", "male"], ["Yves", "female"]
    ]);
    const GROUP_ALIASES = Object.freeze({
        idle: ["(G)I-DLE", "G-IDLE", "GIDLE"],
        nct127: ["NCT127"],
        tomorrowxtogethertxt: ["TXT", "Tomorrow X Together"]
    });

    function comparable(value) {
        return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
    }
    function slug(value) { return comparable(value) || "person"; }
    function photoSlug(value) {
        const aliases = { "D.O.": "d-o", "I.N.": "in", "I.M.": "im", "O.de": "o-de", "B.I": "b-i" };
        return aliases[value] || String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    function catalogPhotoUrl(entry) {
        const groupAliases = { "&TEAM": "and-team", "i-dle": "idle", "NCT 127": "nct-127", "TOMORROW X TOGETHER (TXT)": "txt" };
        const group = entry.group ? (groupAliases[entry.group] || photoSlug(entry.group)) : "solista";
        return `assets/participants/${group}-${photoSlug(entry.name)}.webp`;
    }
    function cloneState(state) { return JSON.parse(JSON.stringify(state)); }
    function groupKeys(name) {
        const key = comparable(name);
        return new Set([key, ...(GROUP_ALIASES[key] || []).map(comparable)]);
    }
    function assertValid(state) {
        const validation = data.validateState(state);
        if (!validation.valid) throw new TypeError(`Participant catalog cannot be applied: ${validation.errors.join(" ")}`);
    }
    function groupForName(state, name) {
        const keys = groupKeys(name);
        return state.groups.find((group) => [...keys].some((key) => key === comparable(group.name))) || null;
    }
    function findExistingParticipant(state, entry, uniqueNameCounts) {
        const nameKey = comparable(entry.name);
        const groupsById = new Map(state.groups.map((group) => [group.id, group]));
        const matches = state.participants.filter((participant) => comparable(participant.name) === nameKey);
        const groupNameKeys = entry.group === null ? null : groupKeys(entry.group);
        const exact = matches.find((participant) => {
            if (entry.group === null) return participant.groupId === null;
            const group = groupsById.get(participant.groupId);
            return Boolean(group && [...groupNameKeys].some((key) => key === comparable(group.name)));
        });
        if (exact) return exact;
        return uniqueNameCounts.get(nameKey) === 1 ? matches[0] || null : null;
    }
    function uniqueId(base, used) {
        if (!used.has(base)) return base;
        return data.createId("fan-choice");
    }

    const entries = Object.freeze([
        ...GROUPS.flatMap(([group, gender, names]) => names.split("|").map((name) => ({ name, group, gender }))),
        ...SOLOISTS.map(([name, gender]) => ({ name, group: null, gender }))
    ]);
    const uniqueNameCounts = new Map();
    entries.forEach((entry) => {
        const key = comparable(entry.name);
        uniqueNameCounts.set(key, (uniqueNameCounts.get(key) || 0) + 1);
    });

    function ensureFanChoiceCatalog(state, timestamp = new Date().toISOString()) {
        assertValid(state);
        if (state.settings.fanChoiceCatalogVersion >= CATALOG_VERSION) {
            return { state: cloneState(state), changed: false, addedGroups: 0, addedParticipants: 0 };
        }
        const nextState = cloneState(state);
        const groupIds = new Set(nextState.groups.map((group) => group.id));
        const participantIds = new Set(nextState.participants.map((participant) => participant.id));
        let addedGroups = 0;
        let addedParticipants = 0;
        let renamedGroups = 0;
        let reassignedParticipants = 0;
        entries.forEach((entry) => {
            let group = entry.group ? groupForName(nextState, entry.group) : null;
            if (entry.group && !group) {
                const baseId = `fan-choice-group-${slug(entry.group)}`;
                const groupId = uniqueId(baseId, groupIds);
                group = data.createGroup({ id: groupId, name: entry.group }, timestamp);
                nextState.groups.push(group);
                groupIds.add(groupId);
                addedGroups += 1;
            }
            if (group && group.name !== entry.group) {
                group.name = entry.group;
                group.updatedAt = timestamp;
                renamedGroups += 1;
            }
            const existing = findExistingParticipant(nextState, entry, uniqueNameCounts);
            if (existing) {
                const expectedGroupId = group?.id || null;
                const expectedPhotoUrl = catalogPhotoUrl(entry);
                if (uniqueNameCounts.get(comparable(entry.name)) === 1 && existing.groupId !== expectedGroupId) {
                    existing.groupId = expectedGroupId;
                    existing.updatedAt = timestamp;
                    reassignedParticipants += 1;
                }
                if (existing.catalogPhotoUrl !== expectedPhotoUrl) {
                    existing.catalogPhotoUrl = expectedPhotoUrl;
                    existing.updatedAt = timestamp;
                }
                return;
            }
            const identity = `${entry.group || "solo"}-${entry.name}`;
            const baseId = `fan-choice-${slug(identity)}`;
            const participantId = uniqueId(baseId, participantIds);
            const participant = data.createParticipant({
                id: participantId,
                name: entry.name,
                groupId: group?.id || null,
                gender: entry.gender,
                categoryIds: [],
                catalogPhotoUrl: catalogPhotoUrl(entry)
            }, timestamp);
            nextState.participants.push(participant);
            participantIds.add(participantId);
            addedParticipants += 1;
        });
        nextState.settings.fanChoiceCatalogVersion = CATALOG_VERSION;
        assertValid(nextState);
        return { state: nextState, changed: true, addedGroups, addedParticipants, renamedGroups, reassignedParticipants };
    }

    namespace.participantCatalog = Object.freeze({
        CATALOG_VERSION,
        entries,
        catalogPhotoUrl,
        ensureFanChoiceCatalog
    });
    root.StatsV2 = namespace;
})(globalThis);
