import { useEffect, useState } from "react";

import styles from "./CustomerIntegration.module.css";

/* =========================
   TypeScript Interfaces
========================= */

interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  businessType: "Manufacturer" | "Distributor" | "Retailer";
  creditLimit: number;
  status: "Active" | "Inactive" | "Pending";
  frappeId: string;
  zohoId: string;
  mongoId: string;
  lastSyncTime: string;
  source: "frappe" | "zoho" | "mongodb";
}

/* =========================
   Mock Data Generator
========================= */

const randomBusinessTypes = [
  "Manufacturer",
  "Distributor",
  "Retailer",
] as const;
const randomStatuses = ["Active", "Inactive", "Pending"] as const;
const randomNames = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
const randomCompanies = [
  "Tech Solutions",
  "Global Traders",
  "Innovatech",
  "Prime Distributors",
  "Retail Hub",
];

/* Function to create a mock customer */

const createMockCustomer = (source: Customer["source"]): Customer => ({
  id: Math.random().toString(36).substring(2),
  companyName:
    randomCompanies[Math.floor(Math.random() * randomCompanies.length)],
  contactPerson: ` ${
    randomNames[Math.floor(Math.random() * randomNames.length)]
  }_${Math.floor(Math.random() * 100)}`,
  email: "contact@example.com",
  businessType:
    randomBusinessTypes[Math.floor(Math.random() * randomBusinessTypes.length)],
  creditLimit: Math.floor(Math.random() * 100000),
  status: randomStatuses[Math.floor(Math.random() * randomStatuses.length)],
  frappeId: source === "frappe" ? "FRP-" + Date.now() : "",
  zohoId: source === "zoho" ? "ZOH-" + Date.now() : "",
  mongoId: source === "mongodb" ? "MDB-" + Date.now() : "",
  lastSyncTime: new Date().toISOString(),
  source,
});

/* =========================
   Mock API Services
========================= */

const mockApi = (
  source: Customer["source"],
  delay: number
): Promise<Customer[]> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 5% failure simulation
      if (Math.random() < 0.05) {
        reject(new Error(`${source} API failed`));
      } else {
        resolve(Array.from({ length: 5 }, () => createMockCustomer(source)));
        // resolve([createMockCustomer(source)]);
      }
    }, delay);
  });
};

/* =========================
   Retry with Exponential Backoff
========================= */

const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (retries === 0) {
      throw new Error("All retries failed");
    }
    await new Promise((res) => setTimeout(res, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
};

/* =========================
   Main Component
========================= */

export default function CustomerIntegration() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState({
    mongodb: false,
    frappe: false,
    zoho: false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | Customer["businessType"]>(
    ""
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "partial" | "failed"
  >("idle");

  const ITEMS_PER_PAGE = 5;

  /* =========================
     Sync Handler
  ========================= */

  const syncCustomers = async () => {
    setErrors({});
    setLoading({ mongodb: true, frappe: true, zoho: true });
    setSyncStatus("syncing");

    try {
      const results = await Promise.allSettled([
        retryWithBackoff(() => mockApi("mongodb", 100)),
        retryWithBackoff(() => mockApi("frappe", 300)),
        retryWithBackoff(() => mockApi("zoho", 500)),
      ]);

      const mergedData: Customer[] = [];
      const localErrors: Record<string, string> = {};

      results.forEach((result, index) => {
        const source = ["mongodb", "frappe", "zoho"][index];

        if (result.status === "fulfilled") {
          mergedData.push(...result.value);
        } else {
          localErrors[source] = result.reason.message;
        }
      });
      setErrors(localErrors);

      const hasErrors = Object.keys(localErrors).length > 0;

      if (mergedData.length > 0 && hasErrors) {
        setSyncStatus("partial");
      } else if (mergedData.length > 0) {
        setSyncStatus("success");
      } else {
        setSyncStatus("failed");
      }

      setCustomers(mergedData);
      setLastUpdated(new Date().toLocaleString());
    } finally {
      setLoading({ mongodb: false, frappe: false, zoho: false });
    }
  };
  /* =========================
      Filtering & Pagination
  ========================= */
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType ? c.businessType === filterType : true;

    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /* =========================
     Initial Load
  ========================= */

  useEffect(() => {
    syncCustomers();
  }, []);

  /* =========================
     Views
  ========================= */

  const loadingView = () => (
    <div className={styles.loading}>
      {Object.entries(loading).map(
        ([key, value]) => value && <p key={key}>Loading {key}...</p>
      )}
    </div>
  );

  const failedView = () => (
    <>
      {Object.entries(errors).map(
        ([key, msg]) =>
          msg && (
            <p key={key} className={styles.error}>
              {key}: {msg}
            </p>
          )
      )}
      <button type="button" className={styles.button} onClick={syncCustomers}>
        Retry
      </button>
    </>
  );

  const successView = () => (
    <>
      <div className={styles.actions}>
        <input
          placeholder="Search company or contact"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
        />
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as any);
            setCurrentPage(1);
          }}
        >
          <option value="">All Types</option>
          <option value="Manufacturer">Manufacturer</option>
          <option value="Distributor">Distributor</option>
          <option value="Retailer">Retailer</option>
        </select>
      </div>

      {paginatedCustomers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Credit Limit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map((c) => (
              <tr key={c.id}>
                <td>{c.companyName}</td>
                <td>{c.contactPerson}</td>
                <td>{c.businessType}</td>
                <td>{c.creditLimit}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filteredCustomers.length > ITEMS_PER_PAGE && (
        <div className={styles.pagination}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );

  let content;
  if (syncStatus === "syncing") content = loadingView();
  else if (syncStatus === "failed") content = failedView();
  else if (syncStatus === "partial")
    content = (
      <>
        {failedView()}
        {successView()}
      </>
    );
  else if (syncStatus === "success") content = successView();

  return (
    
    <div className={styles.container}>
      <h2>B2B Customer Integration</h2>

      {syncStatus === "success" && (
        <button type="button" className={styles.button} onClick={syncCustomers}>
          Sync Customers
        </button>
      )}

      <p className={styles.status}>Last Updated: {lastUpdated || "Never"}</p>
      <p className={styles.status}>
        Sync Status: {syncStatus === "syncing" && "Syncing..."}
        {syncStatus === "success" && "Success"}
        {syncStatus === "partial" && "Partial Success"}
        {syncStatus === "failed" && "Failed"}
      </p>

      {content}
    </div>
  );
}
