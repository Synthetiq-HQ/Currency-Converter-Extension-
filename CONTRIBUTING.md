# Contributing

Read PROJECT_GOAL_AND_SCOPE.md and AGENTS.md first. Keep the extension dependency-free at runtime. currency.js is the shared parser; rates.js owns the bounded cache/provider flow; background.js handles browser APIs; popup and settings have separate pages. Page selections must never be logged or sent to public providers.

Run `node --test tests/*.test.js`, syntax-check changed JavaScript, then `python3 scripts/package.py`. Add focused regression cases for parsing, provider failover, caching, permissions or selection races when those behaviours change. Record actual browser tests and limits in TEST_PLAN.md. Update AI_CONTRIBUTIONS.md when assistance or libraries change. Open a pull request against the personal upstream repository.
