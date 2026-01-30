import { useState, useEffect, useRef, useCallback } from "react";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import { useIdleTimer } from "react-idle-timer";

import CoffeeGrid from "./components/CoffeeGrid";
import coffeeData from "./config/CoffeeData";
import TimeoutScreen from "./components/TimeoutScreen";
import TechKeyboard from "./components/TechKeyboard";
import SugarPanel from "./components/SugarPanel";
import LoadingScreen from "./components/LoadingScreen";

function App() {
  const autoResumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // --- UI & state control ---
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lines, setLines] = useState<string[]>(["Oczekiwanie na dane"]);
  const [tech, setTech] = useState(false);
  const [progress, setProgress] = useState(1);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasCredit, setHasCredit] = useState(false);
  const [] = useState(false);

  // --- Price & order control ---
  const [current, setCurrentPrice] = useState<number | null>(null);
  const currentPriceRef = useRef<number | null>(null);
  const getCurrentPrice = useCallback(() => currentPriceRef.current, []);
  useEffect(() => {
    currentPriceRef.current = current;
  }, [current]);
  const lastProductRef = useRef<string | number | null>(null);

  // --- Coffee List ---
  const [coffeeList, setCoffeeList] = useState(() => {
    const stored = localStorage.getItem("coffee-prices");
    return stored ? JSON.parse(stored) : coffeeData;
  });
  useEffect(() => {
    localStorage.setItem("coffee-prices", JSON.stringify(coffeeList));
  }, [coffeeList]);

  // --- Prevent dragging images ---
  useEffect(() => {
    document
      .querySelectorAll("img")
      .forEach((img) => img.setAttribute("draggable", "false"));
  }, []);

  const clearAutoResumeTimer = () => {
    if (autoResumeTimeout.current) {
      clearTimeout(autoResumeTimeout.current);
      autoResumeTimeout.current = null;
    }
  };

  // --- WebSocket Handling ---
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWebSocket = useCallback(() => {
    ws.current = new WebSocket("ws://0.0.0.0:8765/");
    ws.current.onopen = () => setWsConnected(true);

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.message) {
          const cleanedLines = msg.message
            .split("\n")
            .filter((line: string) => !line.startsWith("LCD Proper:"));
          setLines(cleanedLines);
        }
      } catch (err) {
        console.error("Invalid JSON:", event.data);
      }
    };

    ws.current.onerror = () => setWsConnected(false);
    ws.current.onclose = () => {
      setWsConnected(false);
      reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      ws.current?.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connectWebSocket]);

  //  --- Idle Timer ---
  useIdleTimer({
    timeout: 1000 * 120, // 2 minutes
    debounce: 500,
    onIdle: () => {
      if (!hasCredit) {
        console.log("User idle — showing timeout screen");
        setIsTimedOut(true);

        // Start timer to auto-resume after 1 minute
        if (autoResumeTimeout.current) {
          clearTimeout(autoResumeTimeout.current);
        }
        autoResumeTimeout.current = setTimeout(() => {
          console.log("Auto-resume triggered after 1 minute");
          setIsTimedOut(false);
        }, 1000 * 60); // 1 minute
      } else {
        console.log("Idle ignored — 'Kredyt' is active");
      }
    },
    onActive: () => {
      console.log("User became active — hiding timeout screen");
      setIsTimedOut(false);

      // Cancel auto-resume timer if user became active
      if (autoResumeTimeout.current) {
        clearTimeout(autoResumeTimeout.current);
        autoResumeTimeout.current = null;
      }
    },
  });

  // --- Order Logic ---
  const click_button = async (servId: string | number) => {
    console.log("order start", servId);
    try {
      const res = await fetch("/vending-machines/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Order failed");
      }

      return await res.json();
    } catch (err) {
      console.error("Order error:", err);
      return null;
    }
  };
  const finishedRef = useRef(false);

  useEffect(() => {
    if (ready && lastProductRef.current != null && !finishedRef.current) {
      finishedRef.current = true;
      product_finished(lastProductRef.current);
    }

    if (!ready) {
      finishedRef.current = false;
    }
  }, [ready]);
  const product_finished = async (product_id: string | number | null) => {
    if (product_id == null) return;

    console.log("called product_finished", product_id);

    try {
      const res = await fetch("/vending-machines/statservice/order_complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id }),
      });

      if (!res.ok) throw new Error("Statservice failed");
      return await res.json();
    } catch (err) {
      console.error("Statservice error:", err);
    }
  };

  const handleCoffeeSelection = async (index: number) => {
    if (!tech && current !== null) return;

    const coffee = coffeeList[index];
    lastProductRef.current = coffee.servId;

    // Start lockout on first click only
    // if (!tech && !firstClickHandled.current) {
    //   setIsOrdering(true);
    //   firstClickHandled.current = true;
    //   setTimeout(() => {
    //     setIsOrdering(false);
    //     firstClickHandled.current = false; // reset for next series
    //   }, 7000);
    // }
    // try {
    //   // --- Special case: zbożowa ---
    //   if (
    //     coffee.name.toLowerCase().includes("zbożowa") ||
    //     coffee.name.toLowerCase().includes("zbożowe")
    //   ) {
    //     await click_button(key_config.enter);
    //     await new Promise((resolve) => setTimeout(resolve, 1000));
    //   }

    //   await click_button(coffee.servId);
    // } catch (err) {
    //   console.error("Order failed:", err);
    // } finally {
    //   if (!tech) setTimeout(() => setIsOrdering(false), 7000);
    // }
  };

  useEffect(() => {
    return () => {
      if (autoResumeTimeout.current) {
        clearTimeout(autoResumeTimeout.current);
      }
    };
  }, []);

  //--- Timeout view ---
  if (isTimedOut && !tech)
    return (
      <>
        <TimeoutScreen />
        <VisuallyHidden>
          <SugarPanel
            tech={tech}
            onClick={click_button}
            lines={lines}
            setTech={setTech}
            setProgress={setProgress}
            setReady={setReady}
            setCurrentPrice={setCurrentPrice}
            setLoading={setLoading}
            setIsTimedOut={setIsTimedOut}
            setHasCredit={setHasCredit}
            clearAutoResumeTimer={clearAutoResumeTimer}
          />
        </VisuallyHidden>
      </>
    );

  // --- Main view ---
  return (
    <>
      <Box
        bg={tech ? "red" : "black"}
        minH="100vh"
        minW="100vw"
        alignContent="center"
      >
        {!wsConnected && <p>Reconnecting...</p>}

        {loading || ready ? (
          <>
            <LoadingScreen progress={progress} ready={ready} />
            <VisuallyHidden>
              <SugarPanel
                tech={tech}
                onClick={click_button}
                lines={lines}
                setTech={setTech}
                setProgress={setProgress}
                setReady={setReady}
                setCurrentPrice={setCurrentPrice}
                setLoading={setLoading}
                setIsTimedOut={setIsTimedOut}
                setHasCredit={setHasCredit}
                clearAutoResumeTimer={clearAutoResumeTimer}
              />
            </VisuallyHidden>
          </>
        ) : (
          <>
            <SugarPanel
              onClick={click_button}
              lines={lines}
              setTech={setTech}
              setProgress={setProgress}
              setReady={setReady}
              setCurrentPrice={setCurrentPrice}
              setLoading={setLoading}
              tech={tech}
              setIsTimedOut={setIsTimedOut}
              setHasCredit={setHasCredit}
              clearAutoResumeTimer={clearAutoResumeTimer}
            />
            {tech && (
              <TechKeyboard
                onClick={click_button}
                getCurrentPrice={getCurrentPrice}
              />
            )}

            <CoffeeGrid
              coffeeList={coffeeList}
              setCoffeeList={setCoffeeList}
              onClick={handleCoffeeSelection}
              tech={tech}
              disabled={!tech && current !== null}
            />
          </>
        )}
      </Box>
    </>
  );
}

export default App;
