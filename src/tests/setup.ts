import "@testing-library/jest-dom";
import { vi } from "vitest";
import React from "react";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverMock;
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock motion and motion/react libraries for synchronous, reliable testing
const mockMotion = {
  div: ({ children, ...props }: any) => React.createElement("div", props, children),
  span: ({ children, ...props }: any) => React.createElement("span", props, children),
  button: ({ children, ...props }: any) => React.createElement("button", props, children),
  section: ({ children, ...props }: any) => React.createElement("section", props, children),
  p: ({ children, ...props }: any) => React.createElement("p", props, children),
  h3: ({ children, ...props }: any) => React.createElement("h3", props, children),
};

vi.mock("motion/react", () => ({
  motion: mockMotion,
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("motion", () => ({
  motion: mockMotion,
  AnimatePresence: ({ children }: any) => children,
}));


