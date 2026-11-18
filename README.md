## Team roles and responsibilities

The team consists of Kaan, Gokdeniz, Ahmet and Efe. The responsibilities
below reflect the Sprint 1 issue plan and may be updated in later sprints.

| Member | Sprint 1 responsibilities |
| --- | --- |
| Kaan | Develop the initial strategic BPMN with Ahmet, model the producer-side processes, and contribute to merging and reviewing the strategic model. |
| Gokdeniz | Document team roles and the project management approach, create the Contribution Matrix template, develop the product backlog with Efe, and plan Sprint 2 and Sprint 3. |
| Ahmet | Set up the repository and GitHub Project, configure the project board, model the customer-side processes, and contribute to merging and reviewing the strategic model. |
| Efe | Coordinate comparison and selection of a use case, obtain and record module-team agreement, scope the two major functionalities, and develop the product backlog with Gokdeniz. |

All members are responsible for reading the case study, contributing to
stakeholder and business process analysis, reviewing the group's work,
and preparing for sprint demonstrations. Each member must understand
and be able to explain the submitted artefacts.

## Sprint 2 checkout model

The [checkout and order-preparation model](Diagrams/Checkout%20diagram.bpmn), [image preview](Diagrams/Checkout%20diagram.png) and [reading guide](docs/checkout-order-preparation.md) cover issue #29. The guide records validation, connection settings, remaining integration work and contribution information. This model is separate from the stock-validation code in PR #42.

## Project management approach

We use Scrum with GitHub Projects to organise work into sprints.
The BRFN MARKETPLACE project board tracks the product backlog,
task ownership, priorities and progress.

### Work tracking

- Each task is recorded as a GitHub issue with a description and assignee.
- Labels identify the type of work.
- The Sprint field identifies the planned sprint.
- The Priority field records the task's priority.
- Issues move through Backlog, To Do (Sprint), In Progress,
  In Review and Done.

### Sprint activities

At sprint planning, the team selects backlog items, confirms priorities
and allocates responsibilities.

During stand-ups, each member explains completed work, planned work
and any blockers, supported by repository or project-board evidence.

At sprint reviews, the team demonstrates its work and records feedback.
The team then reviews its working approach and agrees improvements
for the next sprint.

### Collaboration and contribution evidence

Members link relevant commits and pull requests to their issues.
Completed work moves to In Review for another member to check before
it is marked Done.

Each member records their contribution through commits, issue updates
and reviews. For shared issues, each member adds a short comment
explaining their own work.

The Contribution Matrix records actual contributions and is reviewed
and signed by all members before submission through the repository.


## Sprint 2 setup

Use Node.js 22 or later, Camunda Desktop Modeler and Camunda 8 Run 8.10.
The Node scripts use built-in modules. Run them from the repository root.

1. Follow the [Camunda 8 Run setup guide](https://docs.camunda.io/docs/self-managed/quickstart/developer-quickstart/c8run/install-start/) to extract Camunda. From the extracted Camunda folder, run `./c8run start` on macOS or Linux, or `.\c8run.exe start` in Windows PowerShell.
2. Check that [the topology endpoint](http://localhost:8080/v2/topology) responds. In Desktop Modeler, select the local connection at `http://localhost:8080/v2`. Use **None** for authentication with the default local setup.
3. From the repository root, run `node --test` for the component tests and `node examples/stock-validation-demo.js` for the stock examples. The examples include an accepted two-producer basket and a rejected request for five apples when only three are available. See the [stock worker guide](docs/stock-worker.md) for configuration and the [commission guide](docs/s2-10-commission.md) for the payout examples.

### Show stock rejection in Camunda

Deploy the checkout BPMN and its four forms together. The checkout model uses deployment binding for those forms, so use one deployment for all five files. Run this from the repository root using a shell such as macOS Terminal or Git Bash. [Camunda deployment API](https://docs.camunda.io/docs/apis-tools/orchestration-cluster-api-rest/specifications/create-deployment/)

```sh
curl --fail-with-body http://localhost:8080/v2/deployments \
  -F 'resources=@Diagrams/Checkout diagram.bpmn' \
  -F 'resources=@forms/brfn-checkout-stock-recovery.form' \
  -F 'resources=@forms/brfn-checkout-amend.form' \
  -F 'resources=@forms/brfn-checkout-fulfilment.form' \
  -F 'resources=@forms/brfn-checkout-review.form'
```

In a separate terminal, start `node src/camunda-stock-worker.js`. Then start a checkout instance with the rejection example below.

```sh
curl --fail-with-body http://localhost:8080/v2/process-instances \
  -H 'Content-Type: application/json' -d @- <<'JSON'
{
  "processDefinitionId": "Process_1pnlr6v",
  "variables": {
    "checkoutId": "CHK-DEMO-001",
    "basket": {
      "items": [
        { "producerId": "farm-a", "productId": "apples", "quantity": 5 },
        { "producerId": "farm-b", "productId": "bread", "quantity": 1 }
      ]
    }
  }
}
JSON
```

In [Tasklist](http://localhost:8080/tasklist), open **Read problems and change the basket**. The form should show the apple shortage. Change the apple quantity to two and submit. In [Operate](http://localhost:8080/operate), check that `stockValidation.canCheckout` changes from `false` to `true` after the new check. The [checkout test notes](tests/sprint2-checkout-tests.md) have sample inputs for the other forms.

### Show a successful simulated payment

1. Open [s2-09-test-payment.bpmn](Diagrams/s2-09-test-payment.bpmn) in Desktop Modeler and deploy it to the local connection using the rocket icon.
2. From the repository root, run `node src/camunda-payment-worker.mjs` in a separate terminal.
3. Use the play button in Modeler to start an instance. Paste the following in the variables box.

   ```json
   {
     "orderId": "DEMO-001",
     "paymentAttemptId": "ATTEMPT-003",
     "amountInPence": 2500
   }
   ```

4. In Operate, open the instance and check that it reached **Test payment recorded**. The **Variables** tab should show `paymentStatus = "succeeded"`, `paymentReference = "SIM-ATTEMPT-003"`, and `paymentProvider = "simulated"`. If the worker exits during a temporary API failure, check the topology endpoint and restart it. [Payment demo notes and evidence](docs/s2-09-test-payment.md)

For the group review, use the [S2-11 integration record](docs/s2-11-integration.md) to show the two-producer order passing from checkout to payment and commission. The recorded run used confirmed checkout data and produced a £16.00 payment and £0.80 commission.
