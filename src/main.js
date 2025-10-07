import { mount } from 'svelte';
import './app.css';
// @ts-ignore
import App from './App.svelte';

// faire le lien entre un emplacement dans le DOM et le composant principal contenu dans le fichier App.svelte, pour que le contenu HTML soit généré dans cet emplacement
const app = mount(App, {
  target: document.getElementById('app'),
});

    const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;

    fetch("https://api.mistral.ai/v1/models", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
        .then((res) => res.json())
        .then((data) => {
            console.log("Modèles disponibles :", data);
        });

export default app;
