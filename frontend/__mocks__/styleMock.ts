const styleMock: Record<string, string> = new Proxy({}, { get: (_, key) => key });
export default styleMock;
