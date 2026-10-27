# Product Backlog and Sprint Plan

Use case: Customer Multi-Vendor Order, Checkout and Payment  
Status: Agreed by the group

## Major Functionalities

1. Checkout and order preparation.
2. Payment and order confirmation.

## Scope

The implementation covers stock validation, delivery or collection
arrangements, customer confirmation, producer-specific orders, sandbox
payment, 5% commission calculation, inventory updates and producer
notifications, including alternative and exception paths.

Weekly settlements, complete product-management interfaces, food-quality
incident management, food-miles reporting and community features are
outside the implementation scope.

## Priorities

- High: Essential functionality or assessment requirement.
- Medium: Supporting documentation and project preparation.

## Sprint 1 — Analysis and Project Foundation

| ID | Backlog item | Owner | Priority | Acceptance criteria |
| --- | --- | --- | --- | --- |
| S1-01 | Set up repository and GitHub Project | Ahmet | High | Repository and board are accessible to the group and module team. Columns, labels, Sprint and Priority fields are configured. |
| S1-02 | Document roles and project management | Gokdeniz | Medium | README records team members, responsibilities and the Scrum approach using GitHub Projects. |
| S1-03 | Create Contribution Matrix template | Gokdeniz | Medium | Editable template is stored in the repository with member details and roles. |
| S1-04 | Analyse the case study | Everyone | High | Stakeholders, major processes and organisational responsibilities are documented and agreed. Each member records their contribution. |
| S1-05 | Select the use case and scope two functionalities | Efe | High | Selected use case, functionality boundaries and module-team agreement are recorded before detailed implementation. |
| S1-06 | Draft strategic BPMN | Kaan and Ahmet | High | Initial actors, organisational areas, main processes and interactions are identified. |
| S1-07 | Model producer-side strategic processes | Kaan | High | Producer-side model represents the relevant enterprise processes and responsibilities. |
| S1-08 | Model customer-side strategic processes | Ahmet | High | Customer-side model represents the relevant enterprise processes and responsibilities. |
| S1-09 | Combine and review strategic BPMN | Kaan and Ahmet | High | Combined model covers major processes, responsibilities, actors, external services and enterprise interactions. |
| S1-10 | Create product backlog | Gokdeniz and Efe | Medium | Work is divided into items with owners, priorities and acceptance criteria. |
| S1-11 | Plan Sprint 2 and Sprint 3 | Gokdeniz | Medium | Work is allocated across the remaining sprints with dependencies considered and group agreement recorded. |
| S1-12 | Prepare Sprint 1 review | Everyone | High | Group can demonstrate and explain the strategic model, analysis, scope, backlog and sprint plan. |

## Sprint 2 — Detailed Modelling and Initial Automation

| ID | Backlog item | Owner | Priority | Acceptance criteria |
| --- | --- | --- | --- | --- |
| S2-01 | Develop i* Strategic Dependency model | Kaan | High | Actors and dependencies are represented and consistent with the enterprise analysis. |
| S2-02 | Develop i* Strategic Rationale model | Ahmet | High | Goals, softgoals, tasks and resources explain stakeholder needs and align with the dependency model. |
| S2-03 | Model checkout and order preparation | Efe | High | Operational BPMN covers stock validation, fulfilment arrangements, customer confirmation and producer-specific order creation, including alternative paths. |
| S2-04 | Model payment and order confirmation | Gokdeniz | High | Operational BPMN covers payment, commission, inventory updates, notifications, declined payments and service outages. |
| S2-05 | Define shared process data | Ahmet | High | Variable names, order states, process handoff and sample data are documented and used consistently. |
| S2-06 | Implement initial stock validation | Kaan | High | Multi-producer basket quantities and availability are checked. Invalid items prevent checkout progression and require amendment. |
| S2-07 | Implement checkout Forms and confirmation | Efe | High | Customers can review supplier-specific fulfilment arrangements, amend the order and confirm. The agreed 48-hour preparation rule is demonstrated. |
| S2-08 | Implement initial order creation | Ahmet | High | Confirmation creates an overall order and correctly linked producer-specific elements awaiting payment. |
| S2-09 | Implement initial test payment | Gokdeniz | High | A Camunda service task submits a sandbox or simulated payment and records the result. Successful payment can be demonstrated. |
| S2-10 | Implement commission calculations | Gokdeniz | High | BRFN's 5% commission and producer allocations match agreed single-vendor and multi-vendor examples. |
| S2-11 | Integrate initial executable processes | Ahmet | High | Both functionalities execute their core paths and exchange the required order data. |
| S2-12 | Test initial functionality | Efe | High | Stock rejection and successful multi-vendor purchase are tested. Results and defects are recorded. |
| S2-13 | Record model traceability and LESP considerations | Efe | High | Stakeholder needs link to i*, strategic BPMN and operational BPMN. Relevant legal, ethical, social and professional considerations are identified. |
| S2-14 | Document initial setup | Gokdeniz | Medium | README explains prerequisites, deployment, test data and how to demonstrate initial functionality. |
| S2-15 | Prepare Sprint 2 review | Everyone | High | Group demonstrates completed models and initial automation, explains limitations and records feedback. |

## Sprint 3 — Completion, Integration and Demonstration

| ID | Backlog item | Owner | Priority | Acceptance criteria |
| --- | --- | --- | --- | --- |
| S3-01 | Complete stock validation and amendment paths | Kaan | High | Customers can amend unavailable items and repeat validation. Stock changes between checkout and payment follow a documented handling rule. |
| S3-02 | Complete fulfilment and confirmation behaviour | Efe | High | Forms validate required inputs, display supplier responsibilities and enforce the agreed preparation-time rule. Amendment and cancellation paths work. |
| S3-03 | Complete order-state handling | Ahmet | High | Orders remain consistent through payment attempts and final outcomes. Repeated requests do not create duplicate orders. |
| S3-04 | Complete payment retries and outage handling | Gokdeniz | High | Declined payments allow retry. Service outages follow a defined recovery path. Retries do not create duplicate charges. |
| S3-05 | Verify commission and producer allocations | Gokdeniz | High | Single-vendor, multi-vendor and rounding tests pass. Producer allocations and commission reconcile to the applicable order amount. |
| S3-06 | Complete successful-payment follow-up | Kaan | High | Successful payment confirms the order, updates inventory and notifies relevant producers. Notification failures are recorded and handled. |
| S3-07 | Complete end-to-end integration | Ahmet | High | Both processes execute together without duplicate orders, charges, inventory deductions or follow-up actions. |
| S3-08 | Complete testing and resolve defects | Efe | High | Tests cover successful purchases, unavailable stock, payment decline, service outage, retries and notification failure. Blocking defects are resolved. |
| S3-09 | Finalise model consistency and LESP evaluation | Efe | High | Models match executable behaviour. Relevant implications are linked to design decisions, and reusable components for Task 2 are documented. |
| S3-10 | Complete setup documentation | Gokdeniz | Medium | Another member can follow the README to deploy both processes and reproduce the main test scenarios. |
| S3-11 | Prepare final demonstration | Everyone | High | All members can demonstrate both functionalities, exception paths and the progression from analysis to implementation. |
| S3-12 | Finalise Contribution Matrix and repository | Gokdeniz coordinates; everyone verifies and signs | High | Actual contributions are agreed and signed. Required artefacts and development evidence are accessible to the module team. |

## Key Dependencies

- Detailed implementation follows recorded module-team agreement.
- Operational models align with the strategic BPMN and i* models.
- Shared process data is defined before integration.
- Payment processing uses the prepared marketplace order.
- Inventory updates and successful-order notifications follow successful payment.
- Final testing follows integration of both functionalities.

## Working Rules

- Owners coordinate their items and obtain teammate review.
- Every member records their own contributions through GitHub.
- Testing and documentation are updated throughout development.
- Backlog changes are recorded through commits, issues and pull requests.
- All payment development and testing uses sandbox or simulated services.

## Sources

- BRFN Case Study - v2.
- Task 1 - Use Cases.
- UFCFTR-30-3 Task 1 Assessment Brief.
- Sprint 1 Issue Plan.
