# RLX Portfolio

Portfolio public de Mardochée Bossede / Rlx.

## Déploiement

Site statique compatible Netlify. Le dossier racine est directement publiable.

## Cloud

Supabase est utilisé pour :
- journaliser des visites anonymes (session locale, chemin, langue, largeur écran),
- recevoir les avis avec modération,
- enregistrer les demandes de commande,
- alimenter la page admin via RLS.

## Paiements

L'interface permet de choisir Visa/Mastercard, Airtel Money, MTN Mobile Money, Orange Money, Wave ou Bitcoin, mais aucun débit réel n'est effectué tant qu'un compte marchand / une passerelle de paiement n'est pas connecté avec ses identifiants sécurisés côté serveur.

## ScreenDrop V5

Le ZIP Windows est disponible dans `downloads/ChatGPT_ScreenDrop_ShiftK_V5.zip`.
