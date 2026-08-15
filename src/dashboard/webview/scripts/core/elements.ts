export const ELEMENT_REGISTRY_SCRIPT = `
    const elements = Object.fromEntries(
      [...document.querySelectorAll('[id]')].map(element => [element.id, element])
    );
`;
