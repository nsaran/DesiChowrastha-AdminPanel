import React from "react";
import GoogleFontLoader from "react-google-font";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/tvmenu-styles.css";

/**
 * MenuPage7 - Bar Menu / Happy Hours
 * 
 * Layout: 4 columns with orange/white theme
 * Column 1: Cocktails, Mocktails, Wine, Whisky
 * Column 2: Bourbon, Indian Single Malt, Scotch, Blended Scotch, Single Malt Scotch, Cognac, Gin, Vodka
 * Column 3: Rum, Tequila, Beer (16oz/Jar/Tower), Bottled & Canned Beer
 * Column 4: Happy Hours (Monday-Friday 4PM-7PM) with specials + Food
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 * Static menu - no API data fetching required
 */
const MenuPage7 = () => {

    // Styles
    const pageStyle = {
        backgroundColor: "#fff",
        minHeight: "100vh",
        padding: "10px 15px",
        fontFamily: "'Bree Serif', serif",
    };

    const categoryTitleStyle = {
        fontFamily: "'Lobster', cursive",
        fontSize: "1.6rem",
        color: "#fd590d",
        marginBottom: "2px",
        marginTop: "10px",
        borderBottom: "2px solid #fd590d",
        paddingBottom: "2px",
    };

    const itemRowStyle = {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "0.85rem",
        lineHeight: "1.5",
        fontFamily: "'Bree Serif', serif",
    };

    const itemNameStyle = {
        flex: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    };

    const itemPriceStyle = {
        textAlign: "right",
        minWidth: "50px",
        fontWeight: "500",
    };

    const dualPriceStyle = {
        textAlign: "right",
        minWidth: "45px",
        fontWeight: "500",
    };

    const subHeaderStyle = {
        display: "flex",
        justifyContent: "flex-end",
        fontSize: "0.75rem",
        fontWeight: "bold",
        fontStyle: "italic",
        marginBottom: "2px",
        gap: "10px",
    };

    const happyHourBoxStyle = {
        backgroundColor: "#fd590d",
        color: "#fff",
        padding: "8px",
        borderRadius: "8px",
        textAlign: "center",
        marginBottom: "8px",
    };

    const happyHourTitleStyle = {
        fontFamily: "'Lobster', cursive",
        fontSize: "1.8rem",
        marginBottom: "0",
    };

    const happyHourSubStyle = {
        fontSize: "1rem",
        fontWeight: "bold",
        marginBottom: "0",
    };

    const happyHourCatStyle = {
        fontFamily: "'Lobster', cursive",
        fontSize: "1.2rem",
        color: "#fd590d",
        marginTop: "8px",
        marginBottom: "2px",
        textDecoration: "underline",
    };

    const happyHourItemStyle = {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "0.8rem",
        lineHeight: "1.5",
        fontWeight: "bold",
    };

    const renderItem = (name, price) => (
        <div style={itemRowStyle} key={name}>
            <span style={itemNameStyle}>{name}</span>
            <span style={itemPriceStyle}>{price}</span>
        </div>
    );

    const renderDualItem = (name, price1, price2) => (
        <div style={itemRowStyle} key={name}>
            <span style={itemNameStyle}>{name}</span>
            <span style={dualPriceStyle}>{price1}</span>
            <span style={dualPriceStyle}>{price2}</span>
        </div>
    );

    const renderTripleItem = (name, price1, price2, price3) => (
        <div style={itemRowStyle} key={name}>
            <span style={itemNameStyle}>{name}</span>
            <span style={dualPriceStyle}>{price1}</span>
            <span style={dualPriceStyle}>{price2}</span>
            <span style={dualPriceStyle}>{price3}</span>
        </div>
    );

    return (
        <div style={pageStyle}>
            <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />
            <Container fluid style={{ padding: "0" }}>
                <Row>
                    {/* Column 1: Cocktails, Mocktails, Wine, Whisky */}
                    <Col style={{ flex: "0 0 25%", maxWidth: "25%", borderRight: "2px solid #fd590d", paddingRight: "10px" }}>
                        <h3 style={categoryTitleStyle}>Cocktails</h3>
                        {renderItem("JALAPENO SPICY MARGARITA", "$ 12.99")}
                        {renderItem("MANGO MARGARITA", "$ 12.99")}
                        {renderItem("STRAWBERRY MARGARITA", "$ 12.99")}
                        {renderItem("LIME MARGARITA", "$ 12.99")}
                        {renderItem("TAMARIND MARGARITA", "$ 12.99")}
                        {renderItem("SKINNYRITA", "$ 12.99")}
                        {renderItem("COSMOPOLITAN", "$ 12.99")}
                        {renderItem("MEXICAN MULE", "$ 12.99")}
                        {renderItem("PINA COLADA", "$ 12.99")}
                        {renderItem("MANHATTAN", "$ 13.99")}
                        {renderItem("OLD FASHIONED (SMOKED)", "$ 13.99")}
                        {renderItem("BLUE ROYAL ENFLIED MOTORCYCLE", "$ 13.99")}
                        {renderItem("CORONARITA", "$ 13.99")}
                        {renderItem("GRAND MARNIER", "$ 14.99")}
                        {renderItem("LOND ISLAND ICE TEA", "$ 14.99")}

                        <h3 style={categoryTitleStyle}>Mocktails</h3>
                        {renderItem("TAMARIND MOJITO / MARGARITA", "$ 9.99")}
                        {renderItem("STRAWBERRY MOJITO / MARGARITA", "$ 9.99")}
                        {renderItem("MANGO MOJITO / MARGARITA", "$ 9.99")}
                        {renderItem("WATERMELON MOJITO / MARGARITA", "$ 9.99")}
                        {renderItem("PINA COLADA", "$ 9.99")}
                        {renderItem("SKINNYRITA", "$ 9.99")}
                        {renderItem("SHIRLEY TEMPLE", "$ 9.99")}

                        <h3 style={categoryTitleStyle}>Wine</h3>
                        <div style={subHeaderStyle}>
                            <span>Glass</span>
                            <span>Bottle</span>
                        </div>
                        {renderDualItem("CHARDONNAY (WHITE)", "$ 6.99", "$ 27.99")}
                        {renderDualItem("PINOT GRIS (WHITE)", "$ 6.99", "$ 27.99")}
                        {renderDualItem("SANTOME (ROSE)", "$ 6.99", "$ 27.99")}
                        {renderDualItem("CABERNET SAUVIGNON (RED)", "$ 6.99", "$ 27.99")}
                        {renderDualItem("PINOT NOIR (RED)", "$ 6.99", "$ 27.99")}
                        {renderDualItem("MERLOT (RED)", "$ 6.99", "$ 27.99")}
                        {renderDualItem("MALBEC (RED)", "$ 6.99", "$ 27.99")}

                        <h3 style={categoryTitleStyle}>Whisky</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("FIREBALL", "$ 2.99", "$ 4.99")}
                        {renderDualItem("JAMESON", "$ 4.99", "$ 6.99")}
                    </Col>

                    {/* Column 2: Bourbon, Indian Single Malt, Scotch, Blended Scotch, Single Malt Scotch, Cognac, Gin, Vodka */}
                    <Col style={{ flex: "0 0 25%", maxWidth: "25%", borderRight: "2px solid #fd590d", paddingLeft: "10px", paddingRight: "10px" }}>
                        <h3 style={categoryTitleStyle}>Bourbon</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("MAKER'S MARK", "$ 5.99", "$ 7.99")}
                        {renderDualItem("WOODFORD RESERVE", "$ 6.99", "$ 8.99")}

                        <h3 style={categoryTitleStyle}>Indian Single Malt</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("AMRUT", "$ 12.99", "$ 15.99")}
                        {renderDualItem("RAMPUR", "$ 12.99", "$ 15.99")}

                        <h3 style={categoryTitleStyle}>Scotch</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("DEWAR'S", "$ 4.99", "$ 6.99")}
                        {renderDualItem("JOHNNIE WALKER RED", "$ 4.99", "$ 6.99")}
                        {renderDualItem("JOHNNIE WALKER BLACK", "$ 7.99", "$ 9.99")}
                        {renderDualItem("CHIVAS REGAL", "$ 7.99", "$ 9.99")}
                        {renderDualItem("JOHNNIE WALKER BLUE", "$ 30.99", "$ 35.99")}

                        <h3 style={categoryTitleStyle}>Single Malt Scotch</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("GLENLIVET 12", "$ 12.99", "$ 14.99")}
                        {renderDualItem("GLENFIDDICH 12", "$ 12.99", "$ 15.99")}
                        {renderDualItem("MACALLAN 12", "$ 12.99", "$ 15.99")}
                        {renderDualItem("DALMORE", "$ 12.99", "$ 15.99")}
                        {renderDualItem("OBAN 14", "$ 13.99", "$ 15.99")}
                        {renderDualItem("BALVENIE 12YR", "$ 14.99", "$ 16.99")}
                        {renderDualItem("GLENFIDDICH 14", "$ 14.99", "$ 16.99")}

                        <h3 style={categoryTitleStyle}>Cognac</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("HENNESSY VSOP", "$ 12.99", "$ 14.99")}
                        {renderDualItem("REMY MARTIN", "$ 10.99", "$ 12.99")}

                        <h3 style={categoryTitleStyle}>Gin</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("HENDRICKS", "$ 3.99", "$ 5.99")}
                        {renderDualItem("BEEFEATER GIN", "$ 5.99", "$ 7.99")}
                        {renderDualItem("BOMBAY SAPPHIRE", "$ 6.99", "$ 8.99")}

                        <h3 style={categoryTitleStyle}>Vodka</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("ABSOLUT VODKA", "$ 5.99", "$ 7.99")}
                        {renderDualItem("CIROC", "$ 5.99", "$ 7.99")}
                        {renderDualItem("STOLICHNAYA", "$ 5.99", "$ 7.99")}
                        {renderDualItem("TITO'S HANDMADE", "$ 5.99", "$ 7.99")}
                        {renderDualItem("GREY GOOSE", "$ 6.99", "$ 8.99")}
                    </Col>

                    {/* Column 3: Rum, Tequila, Beer, Bottled & Canned Beer */}
                    <Col style={{ flex: "0 0 25%", maxWidth: "25%", borderRight: "2px solid #fd590d", paddingLeft: "10px", paddingRight: "10px" }}>
                        <h3 style={categoryTitleStyle}>Rum</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("CASTILLO SILVER RUM", "$ 3.99", "$ 5.99")}
                        {renderDualItem("BACARDI", "$ 4.99", "$ 6.99")}
                        {renderDualItem("CAPTAIN MORGAN", "$ 4.99", "$ 6.99")}
                        {renderDualItem("OLD MONK", "$ 5.99", "$ 7.99")}

                        <h3 style={categoryTitleStyle}>Tequila</h3>
                        <div style={subHeaderStyle}>
                            <span>Single</span>
                            <span>Double</span>
                        </div>
                        {renderDualItem("PATRON SILVER", "$ 9.99", "$ 11.99")}
                        {renderDualItem("CASAMIGOS BLANCO", "$ 9.99", "$ 11.99")}
                        {renderDualItem("DON JULIO BLANCO", "$ 10.99", "$ 12.99")}

                        <h3 style={categoryTitleStyle}>Beer</h3>
                        <div style={subHeaderStyle}>
                            <span>16 OZ</span>
                            <span>Jar</span>
                            <span>Tower</span>
                        </div>
                        {renderTripleItem("MILLER", "$ 4.99", "$ 16.99", "$ 25.99")}
                        {renderTripleItem("KINGFISHER", "$ 5.99", "$ 16.99", "$ 30.99")}
                        {renderTripleItem("HEINEKEN", "$ 5.99", "$ 16.99", "$ 30.99")}
                        {renderTripleItem("CORONA", "$ 5.99", "$ 16.99", "$ 30.99")}
                        {renderTripleItem("MODELO", "$ 5.99", "$ 16.99", "$ 30.99")}
                        {renderTripleItem("APPLE CIDAR", "$ 6.99", "$ 17.99", "$ 31.99")}
                        {renderTripleItem("BLUE MOON", "$ 6.99", "$ 17.99", "$ 32.99")}
                        {renderTripleItem("HAZY LITTLE", "$ 6.99", "$ 17.99", "$ 32.99")}
                        {renderTripleItem("SOLACE", "$ 7.99", "$ 20.99", "$ 38.99")}

                        <h3 style={categoryTitleStyle}>Bottled & Canned Beer</h3>
                        {renderItem("KINGFISHER (12OZ)", "$ 4.99")}
                        {renderItem("CORONA (12OZ)", "$ 4.99")}
                        {renderItem("TAJ MAHAL (12OZ)", "$ 5.99")}
                        {renderItem("WOODPECKER (22OZ)", "$ 5.99")}
                        {renderItem("RUPEE BASMATI RICE (16OZ)", "$ 6.99")}
                        {renderItem("RUPEE MANGO WHEAT (16OZ)", "$ 6.99")}
                        {renderItem("HAWARDS 5000 (22OZ)", "$ 10.99")}
                        {renderItem("FLYING HOURSE (22OZ)", "$ 10.99")}
                    </Col>

                    {/* Column 4: Happy Hours */}
                    <Col style={{ flex: "0 0 25%", maxWidth: "25%", paddingLeft: "10px" }}>
                        <div style={happyHourBoxStyle}>
                            <h2 style={happyHourTitleStyle}>HAPPY HOURS</h2>
                            <p style={happyHourSubStyle}>MONDAY – FRIDAY</p>
                            <p style={happyHourSubStyle}>4 PM – 7 PM</p>
                        </div>

                        <h4 style={happyHourCatStyle}>Whiskey</h4>
                        <div style={happyHourItemStyle}>
                            <span>JAMESON</span><span>: $ 3.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>DEWAR'S</span><span>: $ 3.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>CHIVAS REGAL</span><span>: $ 6.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>JOHNNIE WALKER BLACK</span><span>: $ 6.99</span>
                        </div>

                        <h4 style={happyHourCatStyle}>Bourbon</h4>
                        <div style={happyHourItemStyle}>
                            <span>MAKER'S MARK</span><span></span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>WOODFORD RESERVE</span><span></span>
                        </div>

                        <h4 style={happyHourCatStyle}>Tequila</h4>
                        <div style={happyHourItemStyle}>
                            <span>MONTEZUMA GOLD</span><span>: $ 2.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>PATRON SILVER</span><span>: $ 8.99</span>
                        </div>

                        <h4 style={happyHourCatStyle}>Vodka</h4>
                        <div style={happyHourItemStyle}>
                            <span>ABSOLUT VODKA</span><span>: $ 3.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>CIROC</span><span>: $ 3.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>STOLICHNAYA</span><span>: $ 3.99</span>
                        </div>

                        <h4 style={happyHourCatStyle}>Beer</h4>
                        <div style={happyHourItemStyle}>
                            <span>KINGFISHER</span><span>: $ 2.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>HEINEKEN</span><span>: $ 3.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>MILLER</span><span>: $ 3.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>SOLACE</span><span>: $ 4.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>BLUE MOON</span><span>: $ 4.99</span>
                        </div>

                        <h4 style={happyHourCatStyle}>Food</h4>
                        <div style={happyHourItemStyle}>
                            <span>CHOWRASTHA FRIED</span><span>: $ 7.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>CHICKEN(CFC)</span><span></span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>GUNTUR KODI VEPUDU</span><span>: $ 7.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>GOBI MANCHURIA</span><span>: $ 6.99</span>
                        </div>
                        <div style={happyHourItemStyle}>
                            <span>SPICY GOBI</span><span>: $ 6.99</span>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default MenuPage7;
