/* Licence catalogue: D365 modules, areas and security roles, with the lowest licence that covers each role (Microsoft Dynamics 365 Licensing Guide, October 2026). Shared with the API: run "npm run sync" after editing. */
self.LicenceCatalog = {
  version: "guide-2026-10",
  note: "F&O modules in the under-licensed report only: Finance, Supply Chain Management, Project Operations, Commerce, plus Team Members use rights. Roles and the lowest licence covering each are from the Microsoft Dynamics 365 Licensing Guide (October 2026). Roles listed in more than one app's table (anyOf) are covered by any of those apps' full licences. Duties, privileges and menu items load from your D365 security export.",
  modules: [
    {
      key: "ALL",
      name: "Everyday (any module)",
      areas: [
        {
          name: "Team Members use rights",
          roles: [
            {
              id: "all-employee",
              name: "Employee self-service",
              licence: "TM",
              source: "guide p.36",
              description:
                "Record your own time or expenses, manage your own employee information, use reports and dashboards."
            },
            {
              id: "all-approver",
              name: "Approver",
              licence: "TM",
              source: "guide p.36",
              description: "Approve time, expenses and invoices."
            },
            {
              id: "all-requester",
              name: "Requisitioner",
              licence: "TM",
              source: "guide p.36",
              description:
                "Create purchase requisitions; create or edit quality-control items and departmental budgets."
            },
            {
              id: "all-viewer",
              name: "Read-only user",
              licence: "TM",
              source: "guide p.36",
              description: "Read access to D365 data for look-ups and reporting."
            }
          ]
        }
      ]
    },
    {
      key: "FIN",
      name: "Finance",
      areas: [
        {
          name: "C-Suite",
          roles: [
            {
              id: "fin-chief-executive-officer",
              name: "Chief executive officer",
              licence: "ACT",
              source: "guide",
              description: "Reviews the financial and operational performance",
              duties: []
            },
            {
              id: "fin-chief-financial-officer",
              name: "Chief financial officer",
              licence: "ACT",
              source: "guide",
              description: "Reviews the financial performance",
              duties: []
            }
          ]
        },
        {
          name: "Budgeting",
          roles: [
            {
              id: "fin-budget-contributor",
              name: "Budget contributor",
              licence: "TM",
              source: "guide",
              description: "Create, update, and approve departmental budget plans.",
              duties: []
            },
            {
              id: "fin-budget-clerk",
              name: "Budget clerk",
              licence: "ACT",
              source: "guide",
              description: "Documents budget events and responds to budget inquiries",
              duties: []
            },
            {
              id: "fin-budget-manager",
              name: "Budget manager",
              licence: "FIN",
              source: "guide",
              description: "Reviews budget process performance and enables the budget process",
              duties: []
            }
          ]
        },
        {
          name: "Financials and Accounting",
          roles: [
            {
              id: "fin-accounts-payable-positive-payment-clerk",
              name: "Accounts payable positive payment clerk",
              licence: "TM",
              source: "guide",
              description: "Document accounts payable positive pay events",
              duties: []
            },
            {
              id: "fin-accountant",
              name: "Accountant",
              licence: "FIN",
              source: "guide",
              description: "Documents accounting events and responds to accounting inquiries",
              duties: []
            },
            {
              id: "fin-accounting-manager",
              name: "Accounting manager",
              licence: "FIN",
              source: "guide",
              description:
                "Reviews accounting, customer invoice, vendor invoice, and payment process performance and enables those processes",
              duties: []
            },
            {
              id: "fin-accounting-supervisor",
              name: "Accounting supervisor",
              licence: "FIN",
              source: "guide",
              description:
                "Reviews accounting process performance and enables the accounting process",
              duties: []
            },
            {
              id: "fin-accounts-payable-centralized-payments-clerk",
              name: "Accounts payable centralized payments clerk",
              licence: "FIN",
              source: "guide",
              description:
                "Documents accounts payable centralized payment events and responds to centralized payment inquiries",
              duties: []
            },
            {
              id: "fin-accounts-payable-clerk",
              name: "Accounts payable clerk",
              licence: "FIN",
              source: "guide",
              description: "Documents vendor invoice events and responds to vendor inquiries",
              duties: []
            },
            {
              id: "fin-accounts-payable-manager",
              name: "Accounts payable manager",
              licence: "FIN",
              source: "guide",
              description:
                "Reviews vendor invoice process performance and enables the vendor invoice process",
              duties: []
            },
            {
              id: "fin-accounts-payable-payments-clerk",
              name: "Accounts payable payments clerk",
              licence: "FIN",
              source: "guide",
              description:
                "Documents accounts payable payment events and responds to payment inquiries",
              duties: []
            },
            {
              id: "fin-accounts-receivable-centralized-payments-clerk",
              name: "Accounts receivable centralized payments clerk",
              licence: "FIN",
              source: "guide",
              description:
                "Documents accounts receivable centralized payment events and responds to centralized payment inquiries",
              duties: []
            },
            {
              id: "fin-accounts-receivable-clerk",
              name: "Accounts receivable clerk",
              licence: "FIN",
              source: "guide",
              description: "Documents customer invoice events and responds to customer inquiries",
              duties: []
            },
            {
              id: "fin-accounts-receivable-manager",
              name: "Accounts receivable manager",
              licence: "FIN",
              source: "guide",
              description:
                "Reviews customer invoice process performance and enables the customer invoice process",
              duties: []
            },
            {
              id: "fin-accounts-receivable-payments-clerk",
              name: "Accounts receivable payments clerk",
              licence: "FIN",
              source: "guide",
              description:
                "Documents accounts receivable payment events and responds to payment inquiries",
              duties: []
            },
            {
              id: "fin-auditor",
              name: "Auditor",
              licence: "FIN",
              source: "guide",
              description:
                "This role is designed for in-house or external auditors. It provides read-only access to a majority of the system. It is also used for audit policy management",
              duties: []
            },
            {
              id: "fin-credit-management-clerk",
              name: "Credit Management Clerk",
              licence: "FIN",
              source: "guide",
              description:
                "Handles day‐to‐day credit reviews and approvals, updates customer credit limits, and places holds/releases on sales orders based on established policies.",
              duties: []
            },
            {
              id: "fin-credit-management-manager",
              name: "Credit Management Manager",
              licence: "FIN",
              source: "guide",
              description:
                "Oversees overall credit policies, sets or adjusts credit limits, and provides final approval or escalation for high‐value credit requests. Typically, responsible for analytics and reporting on credit risks.",
              duties: []
            },
            {
              id: "fin-collections-agent",
              name: "Collections agent",
              licence: "FIN",
              source: "guide",
              description: "Documents collections events and responds to collections inquiries",
              duties: []
            },
            {
              id: "fin-collections-manager",
              name: "Collections manager",
              licence: "FIN",
              source: "guide",
              description:
                "Reviews collections process performance and enables the collections process",
              duties: []
            },
            {
              id: "fin-financial-controller",
              name: "Financial controller",
              licence: "FIN",
              source: "guide",
              description: "Reviews all accounting process performance and enables those processes",
              duties: []
            },
            {
              id: "fin-global-cost-accountant",
              name: "Global cost accountant",
              licence: "FIN",
              source: "guide",
              description:
                "Manages global cost accounting processes across legal entities. Analyzes cost data, performs cost roll-ups, and ensures consistency in inventory valuation and standard cost calculations.",
              duties: [],
              anyOf: ["FIN", "SCM"]
            },
            {
              id: "fin-global-cost-accounting-manager",
              name: "Global cost accounting manager",
              licence: "FIN",
              source: "guide",
              description:
                "Oversees global cost accounting strategy and processes. Defines costing policies, ensures cross-entity consistency, and approves cost roll-ups and adjustments in accordance with financial standards.",
              duties: []
            },
            {
              id: "fin-globalization-feature-developer",
              name: "Globalization feature developer",
              licence: "FIN",
              source: "guide",
              description:
                "Develops and maintains localization and globalization features. Ensures that legal, tax, and regulatory requirements are supported across geographies in compliance with local laws and reporting needs.",
              duties: [],
              anyOf: ["FIN", "SCM"]
            },
            {
              id: "fin-invoice-capture-operator",
              name: "Invoice Capture Operator",
              licence: "ACT",
              source: "guide",
              description:
                "Manages the intake and processing of vendor invoices using invoice capture solutions. Reviews scanned or imported invoices for accuracy, ensures correct data extraction, and submits invoices for validation and approval workflows.",
              duties: []
            },
            {
              id: "fin-landed-cost-manager",
              name: "Landed cost manager",
              licence: "FIN",
              source: "guide",
              description:
                "Leads landed cost processing and configuration. Manages allocation templates, cost components, and monitors accuracy of landed cost calculations for inbound supply chain.",
              duties: [],
              anyOf: ["FIN", "SCM"]
            },
            {
              id: "fin-lease-accountant",
              name: "Lease accountant",
              licence: "FIN",
              source: "guide",
              description:
                "Manages lease accounting processes in compliance with financial reporting standards. Maintains lease schedules, performs lease classification, calculates lease liabilities and assets, and ensures accurate recognition in the general ledger.",
              duties: []
            },
            {
              id: "fin-lease-clerk",
              name: "Lease clerk",
              licence: "FIN",
              source: "guide",
              description:
                "Supports lease administration by entering and maintaining lease data. Assists with documentation, tracks key lease terms and dates, and ensures data accuracy for accounting and reporting purposes.",
              duties: []
            },
            {
              id: "fin-revenue-recognition-manager",
              name: "Revenue recognition manager",
              licence: "FIN",
              source: "guide",
              description:
                "Oversees the revenue recognition process to ensure compliance with accounting standards. Reviews contracts, applies recognition rules, and ensures timely and accurate posting of revenue transactions to the general ledger.",
              duties: []
            },
            {
              id: "fin-tax-accountant",
              name: "Tax accountant",
              licence: "FIN",
              source: "guide",
              description: "Documents fiscal events and responds to fiscal inquires",
              duties: []
            },
            {
              id: "fin-tax-engine-developer",
              name: "Tax engine developer",
              licence: "FIN",
              source: "guide",
              description: "Create and manage taxable document model mappings.",
              duties: []
            },
            {
              id: "fin-tax-engine-functional-consultant",
              name: "Tax engine functional consultant",
              licence: "FIN",
              source: "guide",
              description:
                "Create and manage generic tax engine components (taxable document and tax document)",
              duties: []
            },
            {
              id: "fin-treasurer",
              name: "Treasurer",
              licence: "FIN",
              source: "guide",
              description: "Documents treasury events and responds to treasury inquiries",
              duties: []
            }
          ]
        },
        {
          name: "General",
          roles: [
            {
              id: "fin-subscription-billing-allocation-manager",
              name: "Subscription billing allocation manager",
              licence: "FIN",
              source: "guide",
              description:
                "Manages allocation of subscription revenue and costs. Defines allocation rules and ensures proper revenue and cost distribution across financial periods.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            },
            {
              id: "fin-subscription-billing-allocation-deferral-and-billing-manager",
              name: "Subscription billing allocation, deferral, and billing manager",
              licence: "FIN",
              source: "guide",
              description:
                "Manages end-to-end subscription billing operations. Oversees billing cycles, deferral schedules, and revenue allocation to ensure accurate financial reporting.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            },
            {
              id: "fin-subscription-billing-assign-revenue-recognition-document-to-",
              name: "Subscription billing assign revenue recognition document to imported deferral schedule process manager",
              licence: "FIN",
              source: "guide",
              description:
                "Manages the assignment of revenue recognition documents to imported deferral schedules. Ensures accuracy of deferred revenue accounting and compliance with recognition rules.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            },
            {
              id: "fin-subscription-billing-deferral-manager",
              name: "Subscription billing deferral manager",
              licence: "FIN",
              source: "guide",
              description:
                "Maintains deferral schedule logic and configuration. Oversees the setup and processing of deferred revenue to ensure proper recognition timelines.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            },
            {
              id: "fin-subscription-billing-manager",
              name: "Subscription billing manager",
              licence: "FIN",
              source: "guide",
              description:
                "Oversees subscription billing lifecycle. Manages billing schedules, pricing models, renewals, and coordination across revenue operations.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            },
            {
              id: "fin-subscription-billing-module-user-with-capabilities-including",
              name: "Subscription billing module user with capabilities including billing, allocation, and deferral features",
              licence: "FIN",
              source: "guide",
              description:
                "Accesses core features of the subscription billing module. Performs tasks related to invoice generation, allocation, and deferral without administrative permissions.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            },
            {
              id: "fin-tax-calculation-developer",
              name: "Tax calculation developer",
              licence: "FIN",
              source: "guide",
              description:
                "Develops and configures tax calculation rules and formulas. Ensures compliance with tax regulations and supports integration with global tax engines.",
              duties: [],
              anyOf: ["FIN", "SCM", "COM"]
            }
          ]
        }
      ]
    },
    {
      key: "SCM",
      name: "Supply Chain Management",
      areas: [
        {
          name: "Asset Management",
          roles: [
            {
              id: "scm-maintenance-requester",
              name: "Maintenance requester",
              licence: "TM",
              source: "guide",
              description:
                "Creates maintenance requests Documents maintenance events and responds to maintenance",
              duties: []
            },
            {
              id: "scm-maintenance-worker",
              name: "Maintenance worker",
              licence: "ACT",
              source: "guide",
              description:
                "inquiries Plans and authorizes maintenance events. Maintains maintenance",
              duties: []
            },
            {
              id: "scm-maintenance-clerk",
              name: "Maintenance clerk",
              licence: "SCM",
              source: "guide",
              description:
                "planning master data and responds to maintenance related inquiries. Enables and reviews the performance of the maintenance process.",
              duties: []
            },
            {
              id: "scm-maintenance-manager",
              name: "Maintenance manager",
              licence: "SCM",
              source: "guide",
              description: "Maintains master data and responds to maintenance related inquiries.",
              duties: []
            }
          ]
        },
        {
          name: "Cost Accounting",
          roles: [
            {
              id: "scm-cost-object-controller",
              name: "Cost object controller",
              licence: "TM",
              source: "guide",
              description:
                "Monitors monetary and non-monetary performance of assigned cost objects",
              duties: []
            },
            {
              id: "scm-cost-accountant",
              name: "Cost accountant",
              licence: "SCM",
              source: "guide",
              description:
                "Implements dimensions, policies, and reporting structures according to the strategy set by the cost accounting manager",
              duties: []
            },
            {
              id: "scm-cost-accountant-clerk",
              name: "Cost accountant clerk",
              licence: "SCM",
              source: "guide",
              description:
                "Performs repetitive tasks aligned with predefined policies and reporting structures",
              duties: []
            },
            {
              id: "scm-cost-accounting-manager",
              name: "Cost accounting manager",
              licence: "SCM",
              source: "guide",
              description:
                "Sets the overall strategy for how cost accounting is performed in the Enterprise",
              duties: []
            },
            {
              id: "scm-inventory-accountant",
              name: "Inventory accountant",
              licence: "SCM",
              source: "guide",
              description:
                "Documents costs, inventory valuations, and cost accounting events. Responds to costs, inventory valuations, and cost accounting events inquiries",
              duties: []
            },
            {
              id: "scm-inventory-accountant-clerk",
              name: "Inventory accountant clerk",
              licence: "SCM",
              source: "guide",
              description:
                "Authorizes and maintains costs, inventory valuations, and cost accounting calculations. Responds to costs, inventory valuations, and cost accounting inquiries",
              duties: []
            },
            {
              id: "scm-global-cost-accountant",
              name: "Global cost accountant",
              licence: "SCM",
              source: "guide",
              description:
                "Manages global cost accounting processes across legal entities. Analyzes cost data, performs cost roll-ups, and ensures consistency in inventory valuation and standard cost calculations.",
              duties: [],
              anyOf: ["SCM", "FIN"]
            },
            {
              id: "scm-globalization-feature-developer",
              name: "Globalization feature developer",
              licence: "SCM",
              source: "guide",
              description:
                "Develops and maintains localization and globalization features. Ensures that legal, tax, and regulatory requirements are supported across geographies in compliance with local laws and reporting needs.",
              duties: [],
              anyOf: ["SCM", "FIN"]
            }
          ]
        },
        {
          name: "Customer Service",
          roles: [
            {
              id: "scm-customer-service-representative",
              name: "Customer service representative",
              licence: "ACT",
              source: "guide",
              description:
                "Documents customer service events and responds to customer service inquiries.",
              duties: []
            },
            {
              id: "scm-customer-service-manager",
              name: "Customer service manager",
              licence: "SCM",
              source: "guide",
              description:
                "Reviews customer service process performance and enables the customer service process",
              duties: []
            }
          ]
        },
        {
          name: "Demand Planning",
          roles: [
            {
              id: "scm-demand-planning-contributor",
              name: "Demand Planning Contributor",
              licence: "SCM",
              source: "guide",
              description:
                "View worksheets (see shared worksheets and save their own views). Collaborate using Microsoft Teams and in-app comments.",
              duties: []
            },
            {
              id: "scm-demand-planning-manager",
              name: "Demand planning manager",
              licence: "SCMP",
              source: "guide",
              description:
                "Includes forecast analysts, market researchers and promotion planners. Forecasts customer demand for products or services. Analyzes historical sales data, market trends, and other factors to predict future demand, including: • Configure the demand planning app (role-level security, time fences, worksheets) • View and create planning data (forecasts and calculations) • View and create tables and import data from excel • View and create transformations • View and create worksheets • Export plans when they're ready to share with Supply Chain Management",
              duties: []
            }
          ]
        },
        {
          name: "Engineering",
          roles: [
            {
              id: "scm-process-engineer",
              name: "Process engineer",
              licence: "SCM",
              source: "guide",
              description: "Defines processes to make new products",
              duties: []
            },
            {
              id: "scm-process-engineering-manager",
              name: "Process engineering manager",
              licence: "SCM",
              source: "guide",
              description: "Reviews and authorizes new production processes",
              duties: []
            },
            {
              id: "scm-product-designer",
              name: "Product designer",
              licence: "SCM",
              source: "guide",
              description: "Designs new and modifies existing Bill of Materials (BOM) structures",
              duties: []
            },
            {
              id: "scm-product-design-manager",
              name: "Product design manager",
              licence: "SCM",
              source: "guide",
              description: "Reviews and authorizes product BOM structures",
              duties: []
            },
            {
              id: "scm-product-engineer",
              name: "Product engineer",
              licence: "SCM",
              source: "guide",
              description:
                "Manages product design data and engineering change orders. Supports the creation and maintenance of product specifications, bills of materials, and version control to ensure manufacturing readiness.",
              duties: []
            },
            {
              id: "scm-product-engineering-manager",
              name: "Product engineering manager",
              licence: "SCM",
              source: "guide",
              description:
                "Leads product engineering activities across design and manufacturing. Oversees engineering change management, approves design revisions, and ensures product data integrity across development and operations.",
              duties: []
            }
          ]
        },
        {
          name: "Distribution",
          roles: [
            {
              id: "scm-landed-cost-agent",
              name: "Landed cost agent",
              licence: "SCM",
              source: "guide",
              description:
                "Manages landed cost calculations and processes. Tracks and allocates additional costs such as freight, duties, and insurance to inbound shipments to ensure accurate inventory valuation and cost accounting.",
              duties: []
            },
            {
              id: "scm-landed-cost-manager",
              name: "Landed cost manager",
              licence: "SCM",
              source: "guide",
              description:
                "Leads landed cost processing and configuration. Manages allocation templates, cost components, and monitors accuracy of landed cost calculations for inbound supply chain.",
              duties: [],
              anyOf: ["SCM", "FIN"]
            },
            {
              id: "scm-receiving-clerk",
              name: "Receiving clerk",
              licence: "ACT",
              source: "guide",
              description:
                "Documents receiving operation events and responds to warehouse receiving operation inquiries",
              duties: []
            },
            {
              id: "scm-shipping-clerk",
              name: "Shipping clerk",
              licence: "ACT",
              source: "guide",
              description:
                "Documents shipping operation events and responds to warehouse shipping operation inquiries",
              duties: []
            },
            {
              id: "scm-warehouse-worker",
              name: "Warehouse worker",
              licence: "ACT",
              source: "guide",
              description:
                "Documents warehouse operation events and responds to warehouse operation inquiries",
              duties: []
            },
            {
              id: "scm-materials-manager",
              name: "Materials manager",
              licence: "SCM",
              source: "guide",
              description:
                "Enables and reviews processes, maintains master data, and responds to inquiries within logistics and material management",
              duties: []
            },
            {
              id: "scm-warehouse-manager",
              name: "Warehouse manager",
              licence: "SCM",
              source: "guide",
              description:
                "Enables and reviews processes, authorizes recordings, maintains master data, and responds to inquiries within warehouse management",
              duties: []
            },
            {
              id: "scm-warehouse-planner",
              name: "Warehouse planner",
              licence: "SCM",
              source: "guide",
              description:
                "Plans and authorizes warehouse work. Maintains warehouse planning master information and responds to warehouse work planning inquiries",
              duties: []
            },
            {
              id: "scm-warehouse-system-integration-operator",
              name: "Warehouse system integration operator",
              licence: "SCM",
              source: "guide",
              description:
                "Maintains the integration between warehouse execution systems and core ERP. Ensures real-time data exchange for inventory updates, task confirmations, and automation equipment synchronization.",
              duties: []
            }
          ]
        },
        {
          name: "Field Service",
          roles: [
            {
              id: "scm-field-service-technician",
              name: "Field service technician",
              licence: "ACT",
              source: "guide",
              description: "Visits customers in the field to perform service orders",
              duties: []
            },
            {
              id: "scm-service-dispatcher",
              name: "Service dispatcher",
              licence: "ACT",
              source: "guide",
              description: "Organizes the service technicians and prioritizes service orders",
              duties: []
            },
            {
              id: "scm-service-delivery-manager",
              name: "Service delivery manager",
              licence: "SCM",
              source: "guide",
              description: "Reviews and enables the service order process",
              duties: []
            }
          ]
        },
        {
          name: "Marketing",
          roles: [
            {
              id: "scm-kit-manager",
              name: "Kit Manager",
              licence: "SCM",
              source: "guide",
              description:
                "Oversees the creation and management of product kits and bundled offerings, maintaining component accuracy across sales and inventory processes.",
              duties: []
            },
            {
              id: "scm-marketing-coordinator",
              name: "Marketing coordinator",
              licence: "SCM",
              source: "guide",
              description: "Produces and distributes marketing materials",
              duties: []
            },
            {
              id: "scm-marketing-manager",
              name: "Marketing manager",
              licence: "SCM",
              source: "guide",
              description: "Manages product marketing",
              duties: []
            }
          ]
        },
        {
          name: "Manufacturing",
          roles: [
            {
              id: "scm-waterspider",
              name: "Waterspider",
              licence: "TM",
              source: "guide",
              description: "Responds to inventory needs on the production line",
              duties: []
            },
            {
              id: "scm-time-registration-user",
              name: "Time registration user",
              licence: "TM",
              source: "guide",
              description: "Worker enabled to use advanced features for time registration",
              duties: []
            },
            {
              id: "scm-machine-operator",
              name: "Machine operator",
              licence: "ACT",
              source: "guide",
              description:
                "Works on production orders and makes registrations in manufacturing execution",
              duties: []
            },
            {
              id: "scm-maintenance-clerk-2",
              name: "Maintenance Clerk",
              licence: "SCM",
              source: "guide",
              description:
                "Supports maintenance operations by entering and updating maintenance requests, tracking asset repair histories, and assisting in the scheduling of routine and corrective maintenance tasks.",
              duties: []
            },
            {
              id: "scm-manufacturing-execution-workload-machine-operator",
              name: "Manufacturing execution workload machine operator",
              licence: "ACT",
              source: "guide",
              description:
                "Operates and monitors machinery within the manufacturing execution system. Records production activities, reports job progress, and ensures adherence to production schedules and quality standards on the production floor.",
              duties: []
            },
            {
              id: "scm-manufacturing-execution-workload-shop-supervisor",
              name: "Manufacturing execution workload shop supervisor",
              licence: "SCM",
              source: "guide",
              description:
                "Oversees production floor operations within the manufacturing execution system. Monitors job progress, assigns tasks to machine operators, ensures safety and compliance, and addresses production issues in real time.",
              duties: []
            },
            {
              id: "scm-hazardous-materials-manager",
              name: "Hazardous materials manager",
              licence: "SCM",
              source: "guide",
              description:
                "Oversees the classification, handling, storage, and documentation of hazardous materials in compliance with safety and regulatory standards. Manages safety data sheets, monitors inventory of hazardous substances, and ensures proper labeling and reporting across the supply chain.",
              duties: []
            },
            {
              id: "scm-shop-supervisor",
              name: "Shop supervisor",
              licence: "ACT",
              source: "guide",
              description:
                "Reviews the time registration process and maintain corrections. Authorizes production feedback registrations and responds to inquiries from production",
              duties: []
            },
            {
              id: "scm-production-manager",
              name: "Production manager",
              licence: "SCM",
              source: "guide",
              description:
                "Reviews the production plan and ensures the proper resources are available",
              duties: []
            },
            {
              id: "scm-production-planner",
              name: "Production planner",
              licence: "SCM",
              source: "guide",
              description: "Schedules and plans productions",
              duties: []
            },
            {
              id: "scm-production-supervisor",
              name: "Production supervisor",
              licence: "SCM",
              source: "guide",
              description:
                "Enables the production process. Ensures the day-to-day execution of orders/jobs so machine operators know what to work on and who is available and can respond to the main requests from machine operator",
              duties: []
            }
          ]
        },
        {
          name: "Procurement",
          roles: [
            {
              id: "scm-buying-agent",
              name: "Buying agent",
              licence: "ACT",
              source: "guide",
              description: "Documents purchase events and responds to purchase inquiries",
              duties: []
            },
            {
              id: "scm-vendor-account-manager",
              name: "Vendor account manager",
              licence: "ACT",
              source: "guide",
              description: "Documents vendor events and responds to vendor inquiries",
              duties: []
            },
            {
              id: "scm-purchasing-agent",
              name: "Purchasing agent",
              licence: "SCM",
              source: "guide",
              description:
                "Documents request for quotation events and responds to request for quotation inquiries. Documents purchasing events and responds to purchasing inquiries. Maintains purchasing agreements and vendor master information",
              duties: []
            },
            {
              id: "scm-purchasing-manager",
              name: "Purchasing manager",
              licence: "SCM",
              source: "guide",
              description:
                "Reviews purchasing process performance and enables the purchasing process. Maintains purchasing agreements and vendor master information",
              duties: []
            }
          ]
        },
        {
          name: "Quality Control",
          roles: [
            {
              id: "scm-quality-control-clerk",
              name: "Quality control clerk",
              licence: "TM",
              source: "guide",
              description:
                "Documents quality control events and responds to quality control inquiries",
              duties: []
            },
            {
              id: "scm-quality-control-manager",
              name: "Quality control manager",
              licence: "SCM",
              source: "guide",
              description:
                "Enables and reviews processes, maintains master data, and responds to inquiries within quality control",
              duties: []
            }
          ]
        },
        {
          name: "Sales",
          roles: [
            {
              id: "scm-sales-clerk",
              name: "Sales clerk",
              licence: "ACT",
              source: "guide",
              description: "Documents sales events and responds to sales inquiries",
              duties: []
            },
            {
              id: "scm-sales-representative",
              name: "Sales representative",
              licence: "ACT",
              source: "guide",
              description: "Documents sales events and responds to sales inquiries",
              duties: []
            },
            {
              id: "scm-sales-manager",
              name: "Sales manager",
              licence: "SCM",
              source: "guide",
              description: "Reviews sales process performance and enables the sales process",
              duties: []
            }
          ]
        },
        {
          name: "Transportation",
          roles: [
            {
              id: "scm-transportation-coordinator",
              name: "Transportation coordinator",
              licence: "SCM",
              source: "guide",
              description:
                "Enables inbound, outbound, rating, routing, and handling of transportation process",
              duties: []
            },
            {
              id: "scm-logistics-manager",
              name: "Logistics manager",
              licence: "SCM",
              source: "guide",
              description:
                "Set up, maintain, and configure the network planning that are used in transportation management processes",
              duties: []
            }
          ]
        },
        {
          name: "General",
          roles: [
            {
              id: "scm-subscription-billing-allocation-manager",
              name: "Subscription billing allocation manager",
              licence: "SCM",
              source: "guide",
              description:
                "Manages allocation of subscription revenue and costs. Defines allocation rules and ensures proper revenue and cost distribution across financial periods.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            },
            {
              id: "scm-subscription-billing-allocation-deferral-and-billing-manager",
              name: "Subscription billing allocation, deferral, and billing manager",
              licence: "SCM",
              source: "guide",
              description:
                "Manages end-to-end subscription billing operations. Oversees billing cycles, deferral schedules, and revenue allocation to ensure accurate financial reporting.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            },
            {
              id: "scm-subscription-billing-assign-revenue-recognition-document-to-",
              name: "Subscription billing assign revenue recognition document to imported deferral schedule process manager",
              licence: "SCM",
              source: "guide",
              description:
                "Manages the assignment of revenue recognition documents to imported deferral schedules. Ensures accuracy of deferred revenue accounting and compliance with recognition rules.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            },
            {
              id: "scm-subscription-billing-deferral-manager",
              name: "Subscription billing deferral manager",
              licence: "SCM",
              source: "guide",
              description:
                "Maintains deferral schedule logic and configuration. Oversees the setup and processing of deferred revenue to ensure proper recognition timelines.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            },
            {
              id: "scm-subscription-billing-manager",
              name: "Subscription billing manager",
              licence: "SCM",
              source: "guide",
              description:
                "Oversees subscription billing lifecycle. Manages billing schedules, pricing models, renewals, and coordination across revenue operations.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            },
            {
              id: "scm-subscription-billing-module-user-with-capabilities-including",
              name: "Subscription billing module user with capabilities including billing, allocation, and deferral features",
              licence: "SCM",
              source: "guide",
              description:
                "Accesses core features of the subscription billing module. Performs tasks related to invoice generation, allocation, and deferral without administrative permissions.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            },
            {
              id: "scm-tax-calculation-developer",
              name: "Tax calculation developer",
              licence: "SCM",
              source: "guide",
              description:
                "Develops and configures tax calculation rules and formulas. Ensures compliance with tax regulations and supports integration with global tax engines.",
              duties: [],
              anyOf: ["SCM", "FIN", "COM"]
            }
          ]
        }
      ]
    },
    {
      key: "PO",
      name: "Project Operations",
      areas: [
        {
          name: "Project Management",
          roles: [
            {
              id: "po-project-resource",
              name: "Project resource",
              licence: "TM",
              source: "guide",
              description:
                "Works on the project as a team member, usually fulfilling a specialized role. Records time and expense entries as they make progress on the project.",
              duties: []
            },
            {
              id: "po-project-timesheet-delegate",
              name: "Project timesheet delegate",
              licence: "TM",
              source: "guide",
              description: "Enables creation and approval of project timesheets",
              duties: []
            },
            {
              id: "po-project-timesheet-user",
              name: "Project timesheet user",
              licence: "TM",
              source: "guide",
              description: "Enables creation and approval of project timesheets",
              duties: []
            },
            {
              id: "po-project-approver",
              name: "Project approver",
              licence: "TM",
              source: "guide",
              description: "Approves time, expenses, and materials within a project",
              duties: []
            },
            {
              id: "po-project-manager",
              name: "Project manager",
              licence: "PO",
              source: "guide",
              description:
                "Creates and plans projects and tasks. Plans \\ resources and estimates the cost and revenue for the project. Reviews and Approves all consultant activity on the project and tracks the progress and spend. Reviews draft invoices.",
              duties: []
            }
          ]
        },
        {
          name: "Project Accounting & Administration",
          roles: [
            {
              id: "po-project-billing-administrator",
              name: "Project billing administrator",
              licence: "PO",
              source: "guide",
              description:
                "Creates project invoices. Manages and maintains invoice layouts. Reviews invoices for accuracy of sales tax codes and exchange rates. Sends invoices to customers and posts invoices to general ledger.",
              duties: []
            },
            {
              id: "po-expense-administrator",
              name: "Expense administrator",
              licence: "PO",
              source: "guide",
              description: "Configures expense management solution",
              duties: []
            },
            {
              id: "po-project-assistant",
              name: "Project assistant",
              licence: "PO",
              source: "guide",
              description:
                "Documents project accounting process events and responds to project accounting process inquiries",
              duties: []
            },
            {
              id: "po-project-accountant",
              name: "Project accountant",
              licence: "PO",
              source: "guide",
              description: "Maintains project accounting policies",
              duties: []
            },
            {
              id: "po-project-supervisor",
              name: "Project supervisor",
              licence: "PO",
              source: "guide",
              description: "Enables and reviews the project accounting process",
              duties: []
            }
          ]
        },
        {
          name: "Project Sales",
          roles: [
            {
              id: "po-account-manager",
              name: "Account manager",
              licence: "PO",
              source: "guide",
              description:
                "Manages sales and relationship for customer-facing projects. Creates and manages new project opportunities, builds proposals, and wins quotes to create project contracts.",
              duties: []
            }
          ]
        },
        {
          name: "Practice Management",
          roles: [
            {
              id: "po-practice-manager",
              name: "Practice manager",
              licence: "PO",
              source: "guide",
              description:
                "Owns the practice in the project organization. Creates reports and dashboards for deals in the pipeline. Understands resource demand and utilization.",
              duties: []
            }
          ]
        },
        {
          name: "Resource Management",
          roles: [
            {
              id: "po-resource-manager",
              name: "Resource manager",
              licence: "PO",
              source: "guide",
              description:
                "Maintains project resource tasks. Staffs project demand and manages resource utilization to ensure resources are appropriately utilized.",
              duties: []
            }
          ]
        },
        {
          name: "General",
          roles: [
            {
              id: "po-engineering-change-request-clerk",
              name: "Engineering change request clerk",
              licence: "ACT",
              source: "guide",
              description:
                "Documents and processes engineering change requests. Assists in tracking changes to project or product specifications and coordinates updates across teams to ensure change control compliance.",
              duties: []
            },
            {
              id: "po-field-service-integration-user",
              name: "Field Service Integration User",
              licence: "ACT",
              source: "guide",
              description:
                "Enables integration between field service operations and project accounting. Supports synchronization of work orders, resource usage, and service-related data across systems to ensure accurate reporting and billing.",
              duties: []
            },
            {
              id: "po-expense-copilot-automation-role",
              name: "Expense Copilot Automation Role",
              licence: "PO",
              source: "guide",
              description:
                "Supports AI-driven automation of expense processing. Enables the Copilot to extract, categorize, and submit expenses on behalf of users, streamlining the expense reporting workflow and reducing manual effort.",
              duties: []
            },
            {
              id: "po-expense-mobile-role",
              name: "Expense Mobile Role",
              licence: "TM",
              source: "guide",
              description:
                "Enables mobile access to expense entry and management features. Allows users to capture receipts, submit expenses, and track status while on the go using mobile applications.",
              duties: []
            },
            {
              id: "po-field-service-integration-admin",
              name: "Field Service Integration Admin",
              licence: "PO",
              source: "guide",
              description:
                "Configures and maintains the integration between Field Service and Project Operations. Ensures accurate synchronization of work orders, resources, and financial data across both workloads.",
              duties: []
            },
            {
              id: "po-office-integration-power-user",
              name: "Office integration power user",
              licence: "PO",
              source: "guide",
              description:
                "Uses advanced Office integration features to manage and interact with project data. Supports importing, exporting, and editing project-related data using Microsoft Office tools like Excel and Word.",
              duties: []
            },
            {
              id: "po-project-account-manager",
              name: "Project account manager",
              licence: "PO",
              source: "guide",
              description:
                "Manages client accounts and financial performance of projects. Oversees billing, monitors project budgets and profitability, and coordinates with stakeholders to ensure financial objectives are met.",
              duties: []
            }
          ]
        }
      ]
    },
    {
      key: "COM",
      name: "Commerce",
      areas: [
        {
          name: "Commerce roles",
          roles: [
            {
              id: "com-retail-warehouse-clerk",
              name: "Retail warehouse clerk",
              licence: "TM",
              source: "guide",
              description:
                "Performs picking, receiving, and stock counting in a store or warehouse",
              duties: []
            },
            {
              id: "com-store-manager",
              name: "Retail store manager",
              licence: "ACT",
              source: "guide",
              description:
                "Performs management functions at the store, such as managing sales reports, inventory movements, and inventory counts",
              duties: []
            },
            {
              id: "com-warehouse-manager",
              name: "Retail warehouse manager",
              licence: "ACT",
              source: "guide",
              description: "Manages order picking, shipping, and receiving for Commerce channels",
              duties: []
            },
            {
              id: "com-distributed-order-management-dom-administrator",
              name: "Distributed order management (DOM) administrator",
              licence: "COM",
              source: "guide",
              description:
                "Defines and maintains the parameters, rules, fulfillment profile, and frequency of DOM executions for the distributed order management feature",
              duties: []
            },
            {
              id: "com-electronic-reporting-for-commerce",
              name: "Electronic reporting for Commerce",
              licence: "COM",
              source: "guide",
              description:
                "Creates and updates electronic reporting configurations for Commerce channels",
              duties: []
            },
            {
              id: "com-retail-store-it",
              name: "Retail store IT",
              licence: "COM",
              source: "guide",
              description: "Performs POS client configuration and installation at the store level",
              duties: []
            },
            {
              id: "com-catalog-manager",
              name: "Retail catalog manager",
              licence: "COM",
              source: "guide",
              description:
                "Manages retail product catalogs. Creates and updates product listings, categories, and attributes to support in-store and online merchandising.",
              duties: []
            },
            {
              id: "com-merchandising-manager",
              name: "Retail merchandising manager",
              licence: "COM",
              source: "guide",
              description:
                "Oversees merchandising strategy. Maintains and replenishes products and assortments, defines pricing strategies, and coordinates promotions across sales channels.",
              duties: []
            },
            {
              id: "com-operations-manager",
              name: "Retail operations manager",
              licence: "COM",
              source: "guide",
              description:
                "Manages day-to-day retail operations. Configures stores, registers, and staff. Oversees store activities, monitors staff performance, and ensures execution of corporate retail strategies.",
              duties: []
            },
            {
              id: "com-retail-service",
              name: "Retail service",
              licence: "COM",
              source: "guide",
              description:
                "Provides support across retail service processes. Handles tasks such as service order management, returns, and customer interaction tracking in retail environments.",
              duties: []
            }
          ]
        },
        {
          name: "General",
          roles: [
            {
              id: "com-subscription-billing-allocation-manager",
              name: "Subscription billing allocation manager",
              licence: "COM",
              source: "guide",
              description:
                "Manages allocation of subscription revenue and costs. Defines allocation rules and ensures proper revenue and cost distribution across financial periods.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            },
            {
              id: "com-subscription-billing-allocation-deferral-and-billing-manager",
              name: "Subscription billing allocation, deferral, and billing manager",
              licence: "COM",
              source: "guide",
              description:
                "Manages end-to-end subscription billing operations. Oversees billing cycles, deferral schedules, and revenue allocation to ensure accurate financial reporting.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            },
            {
              id: "com-subscription-billing-assign-revenue-recognition-document-to-",
              name: "Subscription billing assign revenue recognition document to imported deferral schedule process manager",
              licence: "COM",
              source: "guide",
              description:
                "Manages the assignment of revenue recognition documents to imported deferral schedules. Ensures accuracy of deferred revenue accounting and compliance with recognition rules.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            },
            {
              id: "com-subscription-billing-deferral-manager",
              name: "Subscription billing deferral manager",
              licence: "COM",
              source: "guide",
              description:
                "Maintains deferral schedule logic and configuration. Oversees the setup and processing of deferred revenue to ensure proper recognition timelines.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            },
            {
              id: "com-subscription-billing-manager",
              name: "Subscription billing manager",
              licence: "COM",
              source: "guide",
              description:
                "Oversees subscription billing lifecycle. Manages billing schedules, pricing models, renewals, and coordination across revenue operations.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            },
            {
              id: "com-subscription-billing-module-user-with-capabilities-including",
              name: "Subscription billing module user with capabilities including billing, allocation, and deferral features",
              licence: "COM",
              source: "guide",
              description:
                "Accesses core features of the subscription billing module. Performs tasks related to invoice generation, allocation, and deferral without administrative permissions.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            },
            {
              id: "com-tax-calculation-developer",
              name: "Tax calculation developer",
              licence: "COM",
              source: "guide",
              description:
                "Develops and configures tax calculation rules and formulas. Ensures compliance with tax regulations and supports integration with global tax engines.",
              duties: [],
              anyOf: ["COM", "FIN", "SCM"]
            }
          ]
        }
      ]
    }
  ]
};
