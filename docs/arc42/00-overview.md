# Family Coordinator -- Architecture Documentation (arc42)

**Version:** 1.0
**Date:** 2026-02-17
**Status:** Living document

---

## Table of Contents

1. [Introduction and Goals](./01-introduction-and-goals.md)
2. [Constraints](./02-constraints.md)
3. [Context and Scope](./03-context-and-scope.md)
4. [Solution Strategy](./04-solution-strategy.md)
5. [Building Block View](./05-building-block-view.md)
6. [Runtime View](./06-runtime-view.md)
7. [Deployment View](./07-deployment-view.md)
8. [Crosscutting Concepts](./08-crosscutting-concepts.md)
9. [Architecture Decisions](./09-architecture-decisions.md)
10. [Quality Requirements](./10-quality-requirements.md)
11. [Risks and Technical Debt](./11-risks-and-technical-debt.md)
12. [Glossary](./12-glossary.md)

---

## About This System

Family Coordinator is a Signal-based calendar agent for managing a shared family Google Calendar. Family members message the bot in natural language (German) to view, create, edit, and delete calendar events. All interaction happens through Signal -- no app switching needed.

**Tech stack:** Node.js 22, TypeScript (native stripping), ESM modules, signal-sdk, Google Calendar API, Anthropic Claude, PostgreSQL, Luxon, Zod, Pino.

**Source:** 27 TypeScript source files across 7 modules (~3,400 LOC).

---

_Generated: 2026-02-17_
_Template: arc42 (https://arc42.org)_
