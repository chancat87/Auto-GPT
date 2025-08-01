import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import { sendGAEvent } from "@/components/analytics/google-analytics";
import { Key, storage } from "@/services/storage/local-storage";

export const startTutorial = (
  emptyNodeList: (forceEmpty: boolean) => boolean,
  setPinBlocksPopover: (value: boolean) => void,
  setPinSavePopover: (value: boolean) => void,
) => {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

  // CSS classes for disabling and highlighting blocks
  const disableClass = "disable-blocks";
  const highlightClass = "highlight-block";
  let isConnecting = false;

  // Helper function to disable all blocks except the target block
  const disableOtherBlocks = (targetBlockSelector: string) => {
    document.querySelectorAll('[data-id^="block-card-"]').forEach((block) => {
      block.classList.toggle(disableClass, !block.matches(targetBlockSelector));
      block.classList.toggle(
        highlightClass,
        block.matches(targetBlockSelector),
      );
    });
  };

  // Helper function to enable all blocks
  const enableAllBlocks = () => {
    document.querySelectorAll('[data-id^="block-card-"]').forEach((block) => {
      block.classList.remove(disableClass, highlightClass);
    });
  };

  // Inject CSS for disabling and highlighting blocks
  const injectStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
            .${disableClass} {
                pointer-events: none;
                opacity: 0.5;
            }
            .${highlightClass} {
                background-color: #ffeb3b;
                border: 2px solid #fbc02d;
                transition: background-color 0.3s, border-color 0.3s;
            }
        `;
    document.head.appendChild(style);
  };

  // Helper function to check if an element is present in the DOM
  const waitForElement = (selector: string): Promise<void> => {
    return new Promise((resolve) => {
      const checkElement = () => {
        if (document.querySelector(selector)) {
          resolve();
        } else {
          setTimeout(checkElement, 10);
        }
      };
      checkElement();
    });
  };

  // Function to detect the correct connection and advance the tour
  const detectConnection = () => {
    const checkForConnection = () => {
      const correctConnection = document.querySelector(
        '[data-testid^="rf__edge-"]',
      );
      if (correctConnection) {
        tour.show("press-run-again");
      } else {
        setTimeout(checkForConnection, 100);
      }
    };

    checkForConnection();
  };

  // Define state management functions to handle connection state
  function startConnecting() {
    isConnecting = true;
  }

  function stopConnecting() {
    isConnecting = false;
  }

  // Reset connection state when revisiting the step
  function resetConnectionState() {
    stopConnecting();
  }

  // Event handlers for mouse down and up to manage connection state
  function handleMouseDown() {
    startConnecting();
    setTimeout(() => {
      if (isConnecting) {
        tour.next();
      }
    }, 100);
  }
  // Event handler for mouse up to check if the connection was successful
  function handleMouseUp(event: { target: any }) {
    const target = event.target;
    const validConnectionPoint = document.querySelector(
      '[data-testid^="rf__node-"]:nth-child(2) [data-id$="-a-target"]',
    );

    if (validConnectionPoint && !validConnectionPoint.contains(target)) {
      setTimeout(() => {
        if (!document.querySelector('[data-testid^="rf__edge-"]')) {
          stopConnecting();
          tour.show("connect-blocks-output");
        }
      }, 200);
    } else {
      stopConnecting();
    }
  }

  // Define the fitViewToScreen function
  const fitViewToScreen = () => {
    const fitViewButton = document.querySelector(
      ".react-flow__controls-fitview",
    ) as HTMLButtonElement;
    if (fitViewButton) {
      fitViewButton.click();
    }
  };

  injectStyles();

  const warningText = emptyNodeList(false)
    ? ""
    : "<br/><br/><b>Caution: Clicking next will start a tutorial and will clear the current flow.</b>";

  tour.addStep({
    id: "starting-step",
    title: "Welcome to the Tutorial",
    text: `This is the AutoGPT builder! ${warningText}`,
    buttons: [
      {
        text: "Skip Tutorial",
        action: () => {
          tour.cancel(); // Ends the tour
          storage.set(Key.SHEPHERD_TOUR, "skipped"); // Set the tutorial as skipped in local storage
        },
        classes: "shepherd-button-secondary", // Optionally add a class for styling the skip button differently
      },
      {
        text: "Next",
        action: () => {
          emptyNodeList(true);
          tour.next();
        },
      },
    ],
  });

  tour.addStep({
    id: "open-block-step",
    title: "Open Blocks Menu",
    text: "Please click the block button to open the blocks menu.",
    attachTo: {
      element: '[data-id="blocks-control-popover-trigger"]',
      on: "right",
    },
    advanceOn: {
      selector: '[data-id="blocks-control-popover-trigger"]',
      event: "click",
    },
    buttons: [],
  });

  tour.addStep({
    id: "scroll-block-menu",
    title: "Scroll Down or Search",
    text: 'Scroll down or search in the blocks menu for the "Calculator Block" and press the block to add it.',
    attachTo: {
      element: '[data-id="blocks-control-popover-content"]',
      on: "right",
    },
    buttons: [],
    beforeShowPromise: () =>
      waitForElement('[data-id="blocks-control-popover-content"]').then(() => {
        disableOtherBlocks(
          '[data-id="block-card-b1ab9b19-67a6-406d-abf5-2dba76d00c79"]',
        );
      }),
    advanceOn: {
      selector: '[data-id="block-card-b1ab9b19-67a6-406d-abf5-2dba76d00c79"]',
      event: "click",
    },
    when: {
      show: () => setPinBlocksPopover(true),
      hide: enableAllBlocks,
    },
  });

  tour.addStep({
    id: "focus-new-block",
    title: "New Block",
    text: "This is the Calculator Block! Let's go over how it works.",
    attachTo: { element: `[data-id="custom-node-1"]`, on: "left" },
    beforeShowPromise: () => waitForElement('[data-id="custom-node-1"]'),
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
    when: {
      show: () => {
        setPinBlocksPopover(false);
        setTimeout(() => {
          fitViewToScreen();
        }, 100);
      },
    },
  });

  tour.addStep({
    id: "input-to-block",
    title: "Input to the Block",
    text: "This is the input pin for the block. You can input the output of other blocks here; this block takes numbers as input.",
    attachTo: { element: '[data-nodeid="1"]', on: "left" },
    buttons: [
      {
        text: "Back",
        action: tour.back,
      },
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    id: "output-from-block",
    title: "Output from the Block",
    text: "This is the output pin for the block. You can connect this to another block to pass the output along.",
    attachTo: { element: '[data-handlepos="right"]', on: "right" },
    buttons: [
      {
        text: "Back",
        action: tour.back,
      },
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    id: "select-operation-and-input",
    title: "Select Operation and Input Numbers",
    text: "Select any mathematical operation you'd like to perform, and enter numbers in both input fields.",
    attachTo: { element: '[data-id="input-handles"]', on: "right" },
    buttons: [
      {
        text: "Back",
        action: tour.back,
      },
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    id: "press-initial-save-button",
    title: "Press Save",
    text: "First we need to save the flow before we can run it!",
    attachTo: {
      element: '[data-id="save-control-popover-trigger"]',
      on: "left",
    },
    advanceOn: {
      selector: '[data-id="save-control-popover-trigger"]',
      event: "click",
    },
    buttons: [
      {
        text: "Back",
        action: tour.back,
      },
    ],
    when: {
      hide: () => setPinSavePopover(true),
    },
  });

  tour.addStep({
    id: "save-agent-details",
    title: "Save the Agent",
    text: "Enter a name for your agent, add an optional description, and then click 'Save agent' to save your flow.",
    attachTo: {
      element: '[data-id="save-control-popover-content"]',
      on: "top",
    },
    buttons: [],
    beforeShowPromise: () =>
      waitForElement('[data-id="save-control-popover-content"]'),
    advanceOn: {
      selector: '[data-id="save-control-save-agent"]',
      event: "click",
    },
    when: {
      hide: () => setPinSavePopover(false),
    },
  });

  tour.addStep({
    id: "press-run",
    title: "Press Run",
    text: "Start your first flow by pressing the Run button!",
    attachTo: {
      element: '[data-testid="primary-action-run-agent"]',
      on: "top",
    },
    advanceOn: {
      selector: '[data-testid="primary-action-run-agent"]',
      event: "click",
    },
    buttons: [],
    beforeShowPromise: () =>
      waitForElement('[data-testid="primary-action-run-agent"]'),
    when: {
      hide: () => {
        setTimeout(() => {
          fitViewToScreen();
        }, 500);
      },
    },
  });

  tour.addStep({
    id: "wait-for-processing",
    title: "Processing",
    text: "Let's wait for the block to finish being processed...",
    attachTo: {
      element: '[data-id^="badge-"][data-id$="-QUEUED"]',
      on: "bottom",
    },
    buttons: [],
    beforeShowPromise: () =>
      waitForElement('[data-id^="badge-"][data-id$="-QUEUED"]').then(
        fitViewToScreen,
      ),
    when: {
      show: () => {
        waitForElement('[data-id^="badge-"][data-id$="-COMPLETED"]').then(
          () => {
            tour.next();
          },
        );
      },
    },
  });

  tour.addStep({
    id: "check-output",
    title: "Check the Output",
    text: "Check here to see the output of the block after running the flow.",
    attachTo: { element: '[data-id="latest-output"]', on: "top" },
    beforeShowPromise: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          waitForElement('[data-id="latest-output"]').then(resolve);
        }, 100);
      }),
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
    when: {
      show: () => {
        fitViewToScreen();
      },
    },
  });

  tour.addStep({
    id: "copy-paste-block",
    title: "Copy and Paste the Block",
    text: "Let’s duplicate this block. Click and hold the block with your mouse, then press Ctrl+C (Cmd+C on Mac) to copy and Ctrl+V (Cmd+V on Mac) to paste.",
    attachTo: { element: '[data-testid^="rf__node-"]', on: "top" },
    buttons: [
      {
        text: "Back",
        action: tour.back,
      },
    ],
    when: {
      show: () => {
        fitViewToScreen();
        waitForElement('[data-testid^="rf__node-"]:nth-child(2)').then(() => {
          tour.next();
        });
      },
    },
  });

  tour.addStep({
    id: "focus-second-block",
    title: "Focus on the New Block",
    text: "This is your copied Calculator Block. Now, let’s move it to the side of the first block.",
    attachTo: { element: '[data-testid^="rf__node-"]:nth-child(2)', on: "top" },
    beforeShowPromise: () =>
      waitForElement('[data-testid^="rf__node-"]:nth-child(2)'),
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    id: "connect-blocks-output",
    title: "Connect the Blocks: Output",
    text: "Now, let's connect the output of the first Calculator Block to the input of the second Calculator Block. Drag from the output pin of the first block to the input pin (A) of the second block.",
    attachTo: {
      element:
        '[data-testid^="rf__node-"]:first-child [data-id$="-result-source"]',
      on: "bottom",
    },

    buttons: [
      {
        text: "Back",
        action: tour.back,
      },
    ],
    beforeShowPromise: () => {
      return waitForElement(
        '[data-testid^="rf__node-"]:first-child [data-id$="-result-source"]',
      );
    },
    when: {
      show: () => {
        fitViewToScreen();
        resetConnectionState(); // Reset state when revisiting this step
        tour.modal.show();
        const outputPin = document.querySelector(
          '[data-testid^="rf__node-"]:first-child [data-id$="-result-source"]',
        );
        if (outputPin) {
          outputPin.addEventListener("mousedown", handleMouseDown);
        }
      },
      hide: () => {
        const outputPin = document.querySelector(
          '[data-testid^="rf__node-"]:first-child [data-id$="-result-source"]',
        );
        if (outputPin) {
          outputPin.removeEventListener("mousedown", handleMouseDown);
        }
      },
    },
  });

  tour.addStep({
    id: "connect-blocks-input",
    title: "Connect the Blocks: Input",
    text: "Now, connect the output to the input pin of the second block (A).",
    attachTo: {
      element: '[data-testid^="rf__node-"]:nth-child(2) [data-id$="-a-target"]',
      on: "top",
    },
    buttons: [],
    beforeShowPromise: () => {
      return waitForElement(
        '[data-testid^="rf__node-"]:nth-child(2) [data-id$="-a-target"]',
      ).then(() => {
        detectConnection();
      });
    },
    when: {
      show: () => {
        tour.modal.show();
        document.addEventListener("mouseup", handleMouseUp, true);
      },
      hide: () => {
        tour.modal.hide();
        document.removeEventListener("mouseup", handleMouseUp, true);
      },
    },
  });

  tour.addStep({
    id: "press-run-again",
    title: "Press Run Again",
    text: "Now, press the Run button again to execute the flow with the new Calculator Block added!",
    attachTo: {
      element: '[data-testid="primary-action-run-agent"]',
      on: "top",
    },
    advanceOn: {
      selector: '[data-testid="primary-action-run-agent"]',
      event: "click",
    },
    buttons: [],
    beforeShowPromise: () =>
      waitForElement('[data-testid="primary-action-run-agent"]'),
    when: {
      hide: () => {
        setTimeout(() => {
          fitViewToScreen();
        }, 500);
      },
    },
  });

  tour.addStep({
    id: "congratulations",
    title: "Congratulations!",
    text: "You have successfully created your first flow. Watch for the outputs in the blocks!",
    beforeShowPromise: () => waitForElement('[data-id="latest-output"]'),
    when: {
      show: () => tour.modal.hide(),
    },
    buttons: [
      {
        text: "Finish",
        action: tour.complete,
      },
    ],
  });

  // Unpin blocks and save menu when the tour is completed or canceled
  tour.on("complete", () => {
    setPinBlocksPopover(false);
    setPinSavePopover(false);
    storage.set(Key.SHEPHERD_TOUR, "completed"); // Optionally mark the tutorial as completed
  });

  for (const step of tour.steps) {
    step.on("show", () => {
      "use client";
      console.debug("sendTutorialStep");

      sendGAEvent("event", "tutorial_step_shown", { value: step.id });
    });
  }

  tour.on("cancel", () => {
    setPinBlocksPopover(false);
    setPinSavePopover(false);
    storage.set(Key.SHEPHERD_TOUR, "canceled"); // Optionally mark the tutorial as canceled
  });

  tour.start();
};
