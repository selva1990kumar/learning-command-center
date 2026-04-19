# System Architecture: Learning Command Center

This document visualizes how data flows through the Learning Command Center ecosystem. The system is built on a Headless Architecture. 

The left side represents the **Automation Flow** (writing to the database via Telegram). 
The right side represents the **Visual Dashboard Flow** (reading from the database via Vercel). 
At the very center is **Notion**, anchoring everything securely as the central database and single source of truth.

## Diagram

```mermaid
flowchart TD
    %% Users
    UserMobile((User\non Phone/Chat))
    UserLaptop((User\non Web Browser))

    %% Interfaces
    Telegram[Telegram Bot]
    VercelUI["React Dashboard\n(Vercel Frontend)"]

    %% Processing Logic
    OpenClaw{"OpenClaw + AI\n(Local Processing)"}
    MCP["mcp-server.js\n(Javascript Action)"]
    VercelAPI["api/notion.js\n(Vercel Secure API)"]

    %% The Database
    Notion[(Notion Database\n'Source of Truth')]

    %% Diagram Flow - Input Path
    UserMobile -- "Types: 'Mark Databricks done'" --> Telegram
    Telegram -- "Sends message" --> OpenClaw
    OpenClaw -- "Understands intent,\n triggers action" --> MCP
    MCP -- "Securely modifies row" --> Notion

    %% Diagram Flow - Output Path
    UserLaptop -- "Loads URL" --> VercelUI
    VercelUI -- "Requests latest stats" --> VercelAPI
    VercelAPI -- "Securely queries data" --> Notion
    
    %% Diagram Flow - Returns
    Notion -. "Provides new data" .-> VercelAPI
    Notion -. "Confirms success" .-> MCP
    
    VercelAPI -. "Updates UI visuals" .-> VercelUI
    MCP -. "Triggers AI summary" .-> OpenClaw
    OpenClaw -. "Replies: 'All done!'" .-> Telegram
    
    %% Styling
    style UserMobile fill:#ffcccc,stroke:#333,stroke-width:2px
    style UserLaptop fill:#ffcccc,stroke:#333,stroke-width:2px
    style Notion fill:#ffeb99,stroke:#333,stroke-width:4px
    style OpenClaw fill:#cce0ff,stroke:#333,stroke-width:2px
    style VercelUI fill:#ccffcc,stroke:#333,stroke-width:2px
```

## The Key Takeaway

The two interfaces (Telegram and your React Dashboard) **never actually communicate directly with each other**. 

Instead, they act independently:
1. OpenClaw acts as an intelligent writer, utilizing the MCP server to directly modify Notion rows using your Notion Token.
2. The deployed Vercel application acts as a clean reader, pulling the latest Notion data whenever you open the dashboard page.

Because Notion acts globally and updates instantly, saving a task in Telegram guarantees your web browser dashboard will reflect the accurate stats on its next load. No sync conflicts, no manual entry—just a clean, decoupled data pipeline.
