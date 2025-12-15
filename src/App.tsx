// import { useState } from 'react'
import "./App.css";
import CustomerIntegration from "./component/CustomerIntegration/CustomerIntegration";
import { ErrorBoundary } from "./component/ErrorBoundary/ErrorBoundary";
function App() {
  // const [count, setCount] = useState(0)

  return (
    <div className="app">
      <ErrorBoundary>
        <CustomerIntegration />
      </ErrorBoundary>
    </div>
  );
}

export default App;
